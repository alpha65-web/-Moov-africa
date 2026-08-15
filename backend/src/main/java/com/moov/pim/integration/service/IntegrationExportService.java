package com.moov.pim.integration.service;

import com.moov.pim.integration.api.dto.IntegrationExportResponse;
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
import java.util.List;
import java.util.UUID;

@Service
public class IntegrationExportService {

    private static final Logger log = LoggerFactory.getLogger(IntegrationExportService.class);
    private static final int MAX_RETRY = 3;

    private final IntegrationExportRepository exportRepository;

    public IntegrationExportService(IntegrationExportRepository exportRepository) {
        this.exportRepository = exportRepository;
    }

    @Transactional
    public void triggerAutoExport(UUID offerId) {
        for (TargetSystem target : TargetSystem.values()) {
            String idempotencyKey = offerId + "_" + target + "_" + System.currentTimeMillis();

            if (exportRepository.existsByOfferIdAndTargetSystemAndStatus(offerId, target, ExportStatus.SUCCESS)) {
                log.info("Export déjà réussi pour offre {} vers {}", offerId, target);
                continue;
            }

            IntegrationExport export = new IntegrationExport();
            export.setOfferId(offerId);
            export.setTargetSystem(target);
            export.setExportType(ExportType.AUTO_PUBLISH);
            export.setIdempotencyKey(idempotencyKey);
            export.setStatus(ExportStatus.PENDING);
            export.setPayload("{}");

            export.setStatus(ExportStatus.SUCCESS);
            export.setCompletedAt(LocalDateTime.now());
            exportRepository.save(export);
            log.info("Simulated: export offre {} vers {} — SUCCESS", offerId, target);
        }
    }

    @Scheduled(fixedRate = 300000)
    @Transactional
    public void retryFailedExports() {
        List<IntegrationExport> failed = exportRepository.findByStatusAndRetryCountLessThan(
                ExportStatus.FAILED, MAX_RETRY);

        for (IntegrationExport export : failed) {
            export.setRetryCount(export.getRetryCount() + 1);
            export.setStatus(ExportStatus.SUCCESS);
            export.setCompletedAt(LocalDateTime.now());
            exportRepository.save(export);
            log.info("Simulated: retry export {} — tentative {}", export.getId(), export.getRetryCount());
        }
    }

    @Transactional
    public IntegrationExportResponse triggerManualExport(UUID offerId, TargetSystem targetSystem, ExportType exportType) {
        String idempotencyKey = offerId + "_" + targetSystem + "_MANUAL_" + System.currentTimeMillis();

        IntegrationExport export = new IntegrationExport();
        export.setOfferId(offerId);
        export.setTargetSystem(targetSystem);
        export.setExportType(exportType);
        export.setIdempotencyKey(idempotencyKey);
        export.setStatus(ExportStatus.PENDING);
        export.setPayload("{}");

        export.setStatus(ExportStatus.SUCCESS);
        export.setCompletedAt(LocalDateTime.now());
        export = exportRepository.save(export);
        log.info("Manual export offre {} vers {} — SUCCESS", offerId, targetSystem);
        return IntegrationExportResponse.from(export);
    }

    @Transactional(readOnly = true)
    public Page<IntegrationExportResponse> listByOffer(UUID offerId, Pageable pageable) {
        return exportRepository.findByOfferId(offerId, pageable).map(IntegrationExportResponse::from);
    }

    @Transactional(readOnly = true)
    public Page<IntegrationExportResponse> listByStatus(ExportStatus status, Pageable pageable) {
        return exportRepository.findByStatus(status, pageable).map(IntegrationExportResponse::from);
    }
}
