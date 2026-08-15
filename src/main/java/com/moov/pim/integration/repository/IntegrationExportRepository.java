package com.moov.pim.integration.repository;

import com.moov.pim.integration.domain.ExportStatus;
import com.moov.pim.integration.domain.IntegrationExport;
import com.moov.pim.integration.domain.TargetSystem;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface IntegrationExportRepository extends JpaRepository<IntegrationExport, UUID> {

    List<IntegrationExport> findByOfferId(UUID offerId);

    List<IntegrationExport> findByStatus(ExportStatus status);

    List<IntegrationExport> findByStatusAndRetryCountLessThan(ExportStatus status, int maxRetry);

    Optional<IntegrationExport> findByIdempotencyKey(String idempotencyKey);

    boolean existsByOfferIdAndTargetSystemAndStatus(UUID offerId, TargetSystem targetSystem, ExportStatus status);
}
