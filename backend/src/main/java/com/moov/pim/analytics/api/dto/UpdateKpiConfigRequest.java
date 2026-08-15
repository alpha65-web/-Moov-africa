package com.moov.pim.analytics.api.dto;

import jakarta.validation.constraints.NotNull;

public record UpdateKpiConfigRequest(
        String label,
        @NotNull Boolean enabled,
        String thresholdExpression
) {}
