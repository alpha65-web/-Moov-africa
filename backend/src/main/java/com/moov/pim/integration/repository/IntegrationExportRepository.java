package com.moov.pim.integration.repository;

import com.moov.pim.integration.domain.ExportStatus;
import com.moov.pim.integration.domain.ExportType;
import com.moov.pim.integration.domain.IntegrationExport;
import com.moov.pim.integration.domain.TargetSystem;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface IntegrationExportRepository extends JpaRepository<IntegrationExport, UUID> {

    List<IntegrationExport> findByOfferId(UUID offerId);

    Page<IntegrationExport> findByOfferId(UUID offerId, Pageable pageable);

    List<IntegrationExport> findByStatus(ExportStatus status);

    Page<IntegrationExport> findByStatus(ExportStatus status, Pageable pageable);

    List<IntegrationExport> findByStatusAndRetryCountLessThan(ExportStatus status, int maxRetry);

    Optional<IntegrationExport> findByIdempotencyKey(String idempotencyKey);

    /**
     * Derniere fiche constituee pour cette offre, quel que soit le systeme cible.
     *
     * Sert a la reexpedition manuelle : le module de diffusion ne sait pas
     * reconstruire une fiche, il rediffuse celle que le cycle de vie lui a
     * transmise a la publication.
     */
    Optional<IntegrationExport> findFirstByOfferIdAndPayloadIsNotNullOrderByCreatedAtDesc(UUID offerId);

    boolean existsByOfferIdAndTargetSystemAndStatus(UUID offerId, TargetSystem targetSystem, ExportStatus status);

    /**
     * Exports d'un systeme destinataire, du plus recent au plus ancien.
     *
     * Sert a constituer le flux de consommation : pour chaque offre, seule la
     * derniere ligne compte, c'est elle qui porte l'etat courant de la fiche du
     * point de vue de ce canal.
     */
    List<IntegrationExport> findByTargetSystemAndPayloadIsNotNullOrderByCreatedAtDesc(TargetSystem targetSystem);

    boolean existsByOfferIdAndTargetSystemAndExportTypeAndCreatedAtAfter(
            UUID offerId, TargetSystem targetSystem, ExportType exportType, java.time.LocalDateTime after);

    /** Derniere ligne ouverte pour un couple offre / systeme destinataire. */
    Optional<IntegrationExport> findFirstByOfferIdAndTargetSystemOrderByCreatedAtDesc(
            UUID offerId, TargetSystem targetSystem);
}
