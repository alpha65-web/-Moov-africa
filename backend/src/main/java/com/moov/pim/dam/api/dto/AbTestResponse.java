package com.moov.pim.dam.api.dto;

import com.moov.pim.dam.domain.AbTest;

import java.time.LocalDateTime;
import java.util.UUID;

public record AbTestResponse(
        UUID id,
        UUID offerId,
        String variantA,
        String variantB,
        String metric,
        String status,
        String winner,
        UUID createdById,
        LocalDateTime createdAt
) {
    public static AbTestResponse from(AbTest test) {
        return new AbTestResponse(
                test.getId(), test.getOfferId(),
                test.getVariantA(), test.getVariantB(),
                test.getMetric(), test.getStatus().name(),
                test.getWinner(), test.getCreatedById(),
                test.getCreatedAt()
        );
    }
}
