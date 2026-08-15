package com.moov.pim.integration.api.dto;

import com.moov.pim.integration.domain.IntegrationExport;

import java.time.LocalDateTime;
import java.util.UUID;

public record IntegrationExportResponse(
        UUID id,
        String targetSystem,
        UUID offerId,
        String exportType,
        String status,
        int retryCount,
        LocalDateTime createdAt,
        LocalDateTime completedAt
) {
    public static IntegrationExportResponse from(IntegrationExport e) {
        return new IntegrationExportResponse(
                e.getId(), e.getTargetSystem().name(), e.getOfferId(),
                e.getExportType().name(), e.getStatus().name(),
                e.getRetryCount(), e.getCreatedAt(), e.getCompletedAt()
        );
    }
}
