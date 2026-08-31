package com.moov.pim.integration.service;

import com.moov.pim.integration.api.dto.IntegrationExportResponse;
import com.moov.pim.integration.api.dto.OfferDiffusionRow;
import com.moov.pim.integration.domain.DeliveryMode;
import com.moov.pim.integration.domain.ExportStatus;
import com.moov.pim.integration.domain.ExportType;
import com.moov.pim.integration.domain.IntegrationExport;
import com.moov.pim.integration.domain.TargetSystem;
import com.moov.pim.integration.domain.IntegrationEndpoint;
import com.moov.pim.integration.repository.IntegrationEndpointRepository;
import com.moov.pim.integration.repository.IntegrationExportRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.data.domain.Page;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.data.domain.Pageable;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.client.RestClient;

import java.time.LocalDateTime;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

@Service
public class IntegrationExportService {

    private static final Logger log = LoggerFactory.getLogger(IntegrationExportService.class);
    private static final int MAX_RETRY = 3;

    private final IntegrationExportRepository exportRepository;
    private final IntegrationEndpointRepository endpointRepository;
    private final RestClient restClient;

    public IntegrationExportService(IntegrationExportRepository exportRepository,
                                    IntegrationEndpointRepository endpointRepository,
                                    RestClient.Builder restClientBuilder) {
        this.exportRepository = exportRepository;
        this.endpointRepository = endpointRepository;
        this.restClient = restClientBuilder.build();
    }

    /**
     * Diffuse la fiche d'une offre publiee vers les trois systemes destinataires.
     *
     * Appelee par {@link OfferDiffusionListener} a chaque publication. Le corps
     * transmis est la fiche complete telle qu'elle etait au moment de la mise en
     * ligne ; il valait auparavant la chaine « {} », ce qui produisait une trace
     * de diffusion sans diffusion.
     *
     * L'idempotence est portee par la cle : une offre deja diffusee avec succes
     * vers un systeme n'est pas rediffusee, ce qui rend l'appel rejouable sans
     * double traitement.
     */
    @Transactional
    public void triggerAutoExport(UUID offerId, String payload) {
        for (TargetSystem target : TargetSystem.values()) {
            String idempotencyKey = offerId + "_" + target + "_" + System.currentTimeMillis();

            // Idempotence : une meme fiche deja remise avec succes n'est pas rediffusee.
            // Le controle porte sur la derniere ligne et non sur l'existence d'un
            // succes quelconque — sinon une offre retiree puis remise en ligne ne
            // repartait jamais, son ancien succes suffisant a la faire ignorer.
            Optional<IntegrationExport> last = exportRepository
                    .findFirstByOfferIdAndTargetSystemOrderByCreatedAtDesc(offerId, target);
            if (last.isPresent()
                    && last.get().getStatus() == ExportStatus.SUCCESS
                    && last.get().getExportType() == ExportType.AUTO_PUBLISH
                    && payload.equals(last.get().getPayload())) {
                log.info("Offre {} déjà diffusée vers {} dans cette version : rien à faire", offerId, target);
                continue;
            }

            IntegrationExport export = new IntegrationExport();
            export.setOfferId(offerId);
            export.setTargetSystem(target);
            export.setExportType(ExportType.AUTO_PUBLISH);
            export.setIdempotencyKey(idempotencyKey);
            export.setPayload(payload);
            export.setStatus(ExportStatus.PENDING);

            deliver(export);
            exportRepository.save(export);
        }
    }

    /**
     * Signale aux systemes destinataires qu'une offre n'est plus en ligne.
     *
     * Le corps transporte l'identifiant et le nouvel etat, pas la fiche : le
     * destinataire n'a pas besoin du detail d'une offre qu'il doit retirer, il a
     * besoin de savoir laquelle et pourquoi. C'est aussi ce qui permet au flux de
     * distinguer une offre retiree d'une offre simplement absente de la page
     * courante.
     */
    @Transactional
    public void triggerWithdrawal(UUID offerId, String newStatus) {
        String payload = "{\"offerId\":\"" + offerId + "\",\"state\":\"WITHDRAWN\",\"status\":\""
                + newStatus + "\"}";

        for (TargetSystem target : TargetSystem.values()) {
            IntegrationExport export = new IntegrationExport();
            export.setOfferId(offerId);
            export.setTargetSystem(target);
            export.setExportType(ExportType.WITHDRAWAL);
            export.setIdempotencyKey(offerId + "_" + target + "_WITHDRAWAL_" + System.currentTimeMillis());
            export.setPayload(payload);
            export.setStatus(ExportStatus.PENDING);

            deliver(export);
            exportRepository.save(export);
        }
    }

    /**
     * Remise de la fiche au systeme destinataire.
     *
     * Cette methode affirmait une diffusion qui n'avait pas lieu : elle basculait
     * l'export en SUCCESS sans appeler personne, son propre journal precisant
     * « adaptateur de destination non raccorde ». L'ecran annoncait donc « diffuse »
     * pour une fiche que personne n'avait recue et que personne ne pouvait lire.
     *
     * Les deux canaux prevus par le sujet — « API ou export » — sont desormais
     * distingues, et dans les deux cas le statut repose sur un fait verifiable :
     *
     *   PUSH — une URL est renseignee pour ce systeme : la fiche lui est envoyee en
     *   HTTP et c'est le code de reponse qui decide du statut. Un refus reste un
     *   echec, avec le code et le message du destinataire.
     *
     *   PULL — aucune URL n'est renseignee : la fiche est mise a disposition sur le
     *   flux /feed, que le destinataire interroge avec sa cle. L'export reste alors
     *   PENDING, c'est-a-dire « constituee, pas encore lue », et ne passera en
     *   SUCCESS qu'au moment ou le systeme tiers l'aura effectivement consommee.
     *
     * Une fiche vide reste un echec dans les deux cas : ce n'est pas une diffusion,
     * c'est une trace de diffusion.
     */
    private void deliver(IntegrationExport export) {
        if (export.getPayload() == null || export.getPayload().isBlank()
                || "{}".equals(export.getPayload().trim())) {
            export.setStatus(ExportStatus.FAILED);
            export.setErrorMessage("Fiche vide : rien à diffuser");
            log.warn("Diffusion de l'offre {} vers {} refusée : fiche vide",
                    export.getOfferId(), export.getTargetSystem());
            return;
        }

        IntegrationEndpoint endpoint = endpointRepository.findById(export.getTargetSystem()).orElse(null);

        if (endpoint == null || !endpoint.isReachable()) {
            export.setDeliveryMode(DeliveryMode.PULL);
            export.setStatus(ExportStatus.PENDING);
            export.setErrorMessage(null);
            export.setCompletedAt(null);
            log.info("Offre {} : fiche mise à disposition de {} sur le flux de consommation "
                            + "({} caractères) — aucune URL de remise n'est configurée pour ce système",
                    export.getOfferId(), export.getTargetSystem(), export.getPayload().length());
            return;
        }

        push(export, endpoint);
    }

    /**
     * Envoi HTTP effectif de la fiche au systeme destinataire.
     *
     * Le corps part tel quel, en JSON. Le statut suit le code de reponse et rien
     * d'autre : un systeme qui repond 500 n'a pas recu la fiche, et l'ecran doit le
     * dire. L'erreur conservee est celle du destinataire, pas une reformulation.
     */
    private void push(IntegrationExport export, IntegrationEndpoint endpoint) {
        export.setDeliveryMode(DeliveryMode.PUSH);
        export.setEndpointUrl(endpoint.getUrl());

        try {
            ResponseEntity<String> response = restClient.post()
                    .uri(endpoint.getUrl())
                    .contentType(MediaType.APPLICATION_JSON)
                    .headers(headers -> {
                        if (endpoint.getAuthHeader() != null && !endpoint.getAuthHeader().isBlank()) {
                            headers.set(HttpHeaders.AUTHORIZATION, endpoint.getAuthHeader());
                        }
                    })
                    .body(export.getPayload())
                    .retrieve()
                    .onStatus(status -> true, (request, res) -> { })
                    .toEntity(String.class);

            export.setHttpStatus(response.getStatusCode().value());

            if (response.getStatusCode().is2xxSuccessful()) {
                export.setStatus(ExportStatus.SUCCESS);
                export.setCompletedAt(LocalDateTime.now());
                export.setErrorMessage(null);
                log.info("Offre {} remise à {} sur {} — HTTP {}",
                        export.getOfferId(), export.getTargetSystem(), endpoint.getUrl(),
                        response.getStatusCode().value());
            } else {
                export.setStatus(ExportStatus.FAILED);
                export.setErrorMessage("Le système destinataire a répondu HTTP "
                        + response.getStatusCode().value()
                        + (response.getBody() == null ? "" : " : " + truncate(response.getBody())));
                log.warn("Offre {} refusée par {} — HTTP {}",
                        export.getOfferId(), export.getTargetSystem(), response.getStatusCode().value());
            }
        } catch (Exception e) {
            export.setStatus(ExportStatus.FAILED);
            export.setErrorMessage("Système destinataire injoignable : " + e.getMessage());
            log.error("Remise vers {} impossible ({}) : {}",
                    export.getTargetSystem(), endpoint.getUrl(), e.getMessage());
        }
    }

    /** Les messages d'erreur des systemes tiers peuvent etre volumineux. */
    private static String truncate(String value) {
        String cleaned = value.replaceAll("\s+", " ").trim();
        return cleaned.length() > 300 ? cleaned.substring(0, 300) + "…" : cleaned;
    }

    /**
     * Reprise des diffusions en echec, exigence NF2 : « reprise apres erreur sans
     * perte de fiche ».
     *
     * La version precedente se contentait de basculer le statut de FAILED a SUCCESS
     * sans rien retenter : un export en echec se reparait tout seul au bout de cinq
     * minutes, sans qu'aucune fiche ne soit repartie. La reprise rejoue desormais la
     * remise avec le corps conserve, et un export qui echoue reste en echec.
     */
    @Scheduled(fixedRate = 300000)
    @Transactional
    public void retryFailedExports() {
        List<IntegrationExport> failed = exportRepository.findByStatusAndRetryCountLessThan(
                ExportStatus.FAILED, MAX_RETRY);

        for (IntegrationExport export : failed) {
            export.setRetryCount(export.getRetryCount() + 1);
            deliver(export);
            exportRepository.save(export);
            log.info("Reprise de l'export {} — tentative {} sur {} : {}",
                    export.getId(), export.getRetryCount(), MAX_RETRY, export.getStatus());
        }
    }

    /**
     * Reexpedition manuelle d'une offre, declenchee par l'administrateur.
     *
     * Rediffuse la derniere fiche constituee pour cette offre. Elle n'est pas
     * reconstruite ici : le module de diffusion ne sait pas ce que contient une
     * fiche, c'est le module du cycle de vie qui le sait et qui la lui transmet a
     * la publication. Une offre jamais publiee n'a donc rien a rediffuser, et la
     * demande est refusee explicitement plutot que de creer un export vide — le
     * corps valait auparavant « {} » et l'export etait tout de meme marque en
     * succes.
     */
    @Transactional
    public IntegrationExportResponse triggerManualExport(UUID offerId, TargetSystem targetSystem, ExportType exportType) {
        String payload = exportRepository
                .findFirstByOfferIdAndPayloadIsNotNullOrderByCreatedAtDesc(offerId)
                .map(IntegrationExport::getPayload)
                .orElseThrow(() -> new IllegalStateException(
                        "Aucune fiche à rediffuser pour cette offre : elle n'a jamais été publiée."));

        String idempotencyKey = offerId + "_" + targetSystem + "_MANUAL_" + System.currentTimeMillis();

        IntegrationExport export = new IntegrationExport();
        export.setOfferId(offerId);
        export.setTargetSystem(targetSystem);
        export.setExportType(exportType);
        export.setIdempotencyKey(idempotencyKey);
        export.setPayload(payload);
        export.setStatus(ExportStatus.PENDING);

        deliver(export);
        export = exportRepository.save(export);
        return IntegrationExportResponse.from(export);
    }

    /**
     * Etat de diffusion de chaque offre ayant fait l'objet d'au moins un export.
     *
     * Repond au rapprochement que le cahier des charges (l. 106) confie au chef de
     * departement : ayant publie les offres, il doit pouvoir constater lesquelles
     * ne sont pas arrivees a destination. Une offre publiee mais absente du
     * resultat n'a jamais ete diffusee du tout — c'est l'ecran appelant, qui
     * connait la liste des offres publiees, qui fait ce rapprochement-la.
     *
     * Lorsque plusieurs exports existent pour un meme couple offre/systeme, c'est
     * le statut le plus favorable qui est retenu : un echec suivi d'une reprise
     * reussie est une diffusion reussie, pas un incident en cours.
     */
    @Transactional(readOnly = true)
    public List<OfferDiffusionRow> reconciliation() {
        Map<UUID, Map<String, ExportStatus>> byOffer = new LinkedHashMap<>();

        for (IntegrationExport export : exportRepository.findAll()) {
            if (export.getOfferId() == null) continue;
            Map<String, ExportStatus> targets =
                    byOffer.computeIfAbsent(export.getOfferId(), key -> new LinkedHashMap<>());
            String target = export.getTargetSystem().name();
            ExportStatus current = targets.get(target);
            if (current == null || rank(export.getStatus()) > rank(current)) {
                targets.put(target, export.getStatus());
            }
        }

        return byOffer.entrySet().stream()
                .map(entry -> {
                    Map<String, String> statuses = new LinkedHashMap<>();
                    entry.getValue().forEach((target, status) -> statuses.put(target, status.name()));
                    return new OfferDiffusionRow(entry.getKey(), statuses);
                })
                .toList();
    }

    /** SUCCESS prime sur PENDING, qui prime sur FAILED. */
    private static int rank(ExportStatus status) {
        return switch (status) {
            case SUCCESS -> 2;
            case PENDING -> 1;
            case FAILED -> 0;
        };
    }

    @Transactional(readOnly = true)
    public Page<IntegrationExportResponse> listByOffer(UUID offerId, Pageable pageable) {
        return exportRepository.findByOfferId(offerId, pageable).map(IntegrationExportResponse::from);
    }

    @Transactional(readOnly = true)
    public Page<IntegrationExportResponse> listAll(Pageable pageable) {
        return exportRepository.findAll(pageable).map(IntegrationExportResponse::from);
    }

    @Transactional(readOnly = true)
    public Page<IntegrationExportResponse> listByStatus(ExportStatus status, Pageable pageable) {
        return exportRepository.findByStatus(status, pageable).map(IntegrationExportResponse::from);
    }
}
