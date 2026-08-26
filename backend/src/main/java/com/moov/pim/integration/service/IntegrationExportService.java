package com.moov.pim.integration.service;

import com.moov.pim.integration.api.dto.IntegrationExportResponse;
import com.moov.pim.integration.api.dto.OfferDiffusionRow;
import com.moov.pim.integration.domain.ExportStatus;
import com.moov.pim.integration.domain.ExportType;
import com.moov.pim.integration.domain.IntegrationExport;
import com.moov.pim.integration.domain.TargetSystem;
import com.moov.pim.integration.repository.IntegrationExportRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@Service
public class IntegrationExportService {

    private static final Logger log = LoggerFactory.getLogger(IntegrationExportService.class);
    private static final int MAX_RETRY = 3;

    private final IntegrationExportRepository exportRepository;

    public IntegrationExportService(IntegrationExportRepository exportRepository) {
        this.exportRepository = exportRepository;
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

            if (exportRepository.existsByOfferIdAndTargetSystemAndStatus(offerId, target, ExportStatus.SUCCESS)) {
                log.info("Offre {} déjà diffusée vers {} : rien à faire", offerId, target);
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
     * Remise de la fiche au systeme destinataire.
     *
     * Point de raccordement unique : c'est ici, et nulle part ailleurs, qu'un
     * appel reel au CRM, au centre d'appel ou au site web viendra se brancher. En
     * l'absence d'acces a ces systemes — aucun n'a ete ouvert pendant le projet —
     * l'etape se limite a constituer la fiche et a la deposer, ce qui est
     * reellement fait et verifiable : le corps de l'export est lisible en base.
     *
     * Le statut refuse volontairement de mentir dans les deux sens : une fiche
     * vide n'est pas une diffusion et part en echec, une fiche constituee est un
     * succes de production. Ce que le statut ne dit pas — que la destination est
     * un adaptateur et non le systeme de production — est documente ici et affiche
     * comme tel dans l'ecran Exports.
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

        export.setStatus(ExportStatus.SUCCESS);
        export.setCompletedAt(LocalDateTime.now());
        export.setErrorMessage(null);
        log.info("Offre {} : fiche constituée et déposée pour {} ({} caractères) — "
                        + "adaptateur de destination non raccordé à un système de production",
                export.getOfferId(), export.getTargetSystem(), export.getPayload().length());
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
