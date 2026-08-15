package com.moov.pim.analytics.api.dto;

import com.moov.pim.analytics.domain.KpiConfig;

import java.time.LocalDateTime;
import java.util.UUID;

public record KpiConfigResponse(
        UUID id,
        String kpiCode,
        String label,
        boolean enabled,
        String thresholdExpression,
        UUID updatedById,
        LocalDateTime updatedAt
) {
    public static KpiConfigResponse from(KpiConfig c) {
        return new KpiConfigResponse(
                c.getId(), c.getKpiCode(), c.getLabel(),
                c.isEnabled(), c.getThresholdExpression(),
                c.getUpdatedById(), c.getUpdatedAt()
        );
    }
}
