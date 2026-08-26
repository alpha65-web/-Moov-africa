package com.moov.pim.integration.repository;

import com.moov.pim.integration.domain.ExportStatus;
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
}
