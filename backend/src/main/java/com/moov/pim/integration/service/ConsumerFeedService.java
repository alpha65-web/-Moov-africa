package com.moov.pim.integration.service;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.moov.pim.integration.api.dto.FeedEntry;
import com.moov.pim.integration.domain.DeliveryMode;
import com.moov.pim.integration.domain.ExportStatus;
import com.moov.pim.integration.domain.ExportType;
import com.moov.pim.integration.domain.IntegrationExport;
import com.moov.pim.integration.domain.TargetSystem;
import com.moov.pim.integration.repository.IntegrationExportRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * Flux consomme en temps reel par le CRM, le centre d'appel et le site web.
 *
 * C'est le canal « API » que le sujet exige a cote de l'export : « l'information
 * produit doit etre consommee en temps reel par differents canaux : API ou export
 * pour le CRM ou le centre d'appel ». Il n'existait pas — les seules routes
 * ouvertes, sous /exports, servent l'administration interne et reclament un jeton
 * d'utilisateur de la plateforme, qu'un systeme tiers n'a pas.
 *
 * Le flux ne relit pas les offres : il sert les fiches deja constituees a la
 * publication et conservees dans les exports. Deux raisons, l'une metier, l'autre
 * d'architecture. Metier : le destinataire doit recevoir l'etat mis en ligne, pas
 * un etat recalcule depuis une offre qui a pu changer entre-temps. Architecture :
 * le module de diffusion ne sait pas ce que contient une fiche, c'est le module du
 * cycle de vie qui le sait et qui la lui transmet.
 *
 * La lecture n'est pas neutre : elle atteste la diffusion. Un export mis a
 * disposition reste PENDING tant que personne ne l'a lu, et ne passe en SUCCESS
 * qu'au moment ou son destinataire le consomme reellement. C'est ce qui distingue
 * ce statut de celui d'avant, qui affirmait une diffusion sans destinataire.
 */
@Service
public class ConsumerFeedService {

    private static final Logger log = LoggerFactory.getLogger(ConsumerFeedService.class);

    private final IntegrationExportRepository exportRepository;
    private final ObjectMapper mapper = new ObjectMapper();

    public ConsumerFeedService(IntegrationExportRepository exportRepository) {
        this.exportRepository = exportRepository;
    }

    /**
     * Fiches destinees a un canal, de la plus recente a la plus ancienne.
     *
     * @param since ne renvoyer que les fiches diffusees apres cet instant. C'est
     *              ce qui rend la consommation incrementale possible : le systeme
     *              tiers rappelle le flux avec l'horodatage de sa derniere
     *              synchronisation au lieu de tout retelecharger.
     */
    @Transactional
    public List<FeedEntry> feedFor(TargetSystem target, LocalDateTime since) {
        Map<UUID, IntegrationExport> latestByOffer = new LinkedHashMap<>();

        for (IntegrationExport export : exportRepository
                .findByTargetSystemAndPayloadIsNotNullOrderByCreatedAtDesc(target)) {
            if (export.getOfferId() == null || export.getStatus() == ExportStatus.FAILED) {
                continue;
            }
            latestByOffer.putIfAbsent(export.getOfferId(), export);
        }

        List<FeedEntry> entries = new ArrayList<>();
        for (IntegrationExport export : latestByOffer.values()) {
            if (since != null && !export.getCreatedAt().isAfter(since)) {
                continue;
            }
            markConsumed(export);
            entries.add(toEntry(export));
        }

        log.info("Flux {} : {} fiche(s) servie(s){}", target, entries.size(),
                since == null ? "" : " depuis " + since);
        return entries;
    }

    /** Fiche d'une offre precise, pour une resynchronisation ciblee. */
    @Transactional
    public FeedEntry entryFor(TargetSystem target, UUID offerId) {
        IntegrationExport export = exportRepository
                .findByTargetSystemAndPayloadIsNotNullOrderByCreatedAtDesc(target).stream()
                .filter(e -> offerId.equals(e.getOfferId()))
                .filter(e -> e.getStatus() != ExportStatus.FAILED)
                .findFirst()
                .orElseThrow(() -> new IllegalArgumentException(
                        "Aucune fiche diffusee vers " + target + " pour cette offre"));

        markConsumed(export);
        return toEntry(export);
    }

    /**
     * Enregistre la lecture effective de la fiche par son destinataire.
     *
     * Une fiche mise a disposition mais jamais lue n'est pas une fiche diffusee.
     * Le passage en SUCCESS est donc declenche ici, par la lecture, et non a la
     * publication : c'est la seule preuve dont dispose la plateforme que
     * l'information est arrivee.
     */
    private void markConsumed(IntegrationExport export) {
        LocalDateTime now = LocalDateTime.now();
        if (export.getConsumedAt() == null) {
            export.setConsumedAt(now);
        }
        export.setConsumedCount(export.getConsumedCount() + 1);

        if (export.getStatus() == ExportStatus.PENDING) {
            export.setStatus(ExportStatus.SUCCESS);
            export.setCompletedAt(now);
            export.setDeliveryMode(DeliveryMode.PULL);
        }
        exportRepository.save(export);
    }

    private FeedEntry toEntry(IntegrationExport export) {
        return new FeedEntry(
                export.getOfferId(),
                export.getExportType() == ExportType.WITHDRAWAL ? "WITHDRAWN" : "ACTIVE",
                export.getCreatedAt(),
                parse(export.getPayload()));
    }

    /**
     * Le corps est restitue en objet et non en chaine : un consommateur qui
     * recevrait du JSON echappe dans une chaine devrait le desérialiser deux fois.
     * Un corps illisible n'est pas masque, il est signale — le taire ferait passer
     * une fiche corrompue pour une fiche valide.
     */
    private Object parse(String payload) {
        try {
            return mapper.readValue(payload, new TypeReference<Map<String, Object>>() {});
        } catch (Exception e) {
            log.error("Fiche illisible dans l'export : {}", e.getMessage());
            return Map.of("error", "Fiche illisible en base");
        }
    }
}
