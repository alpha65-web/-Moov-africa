package com.moov.pim.lifecycle.api.dto;

import com.moov.pim.lifecycle.domain.Offer;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

public record OfferResponse(
        UUID id,
        String name,
        String shortDescription,
        String longDescription,
        String seoTitle,
        String seoDescription,
        String status,
        BigDecimal promotionalPrice,
        String currency,
        LocalDateTime validFrom,
        LocalDateTime validUntil,
        String targetSegment,
        String customerType,
        float qualityScore,
        LocalDateTime publishDate,
        String legalMentions,
        UUID createdById,
        UUID enrichedById,
        long currentVersion,
        LocalDateTime createdAt,
        LocalDateTime updatedAt,
        List<UUID> catalogItemIds
) {
    public static OfferResponse from(Offer offer) {
        List<UUID> itemIds = offer.getItems().stream()
                .map(item -> item.getCatalogItemId())
                .toList();

        return new OfferResponse(
                offer.getId(),
                offer.getName(),
                offer.getShortDescription(),
                offer.getLongDescription(),
                offer.getSeoTitle(),
                offer.getSeoDescription(),
                offer.getStatus().name(),
                offer.getPromotionalPrice(),
                offer.getCurrency(),
                offer.getValidFrom(),
                offer.getValidUntil(),
                offer.getTargetSegment() != null ? offer.getTargetSegment().name() : null,
                offer.getCustomerType() != null ? offer.getCustomerType().name() : null,
                offer.getQualityScore(),
                offer.getPublishDate(),
                offer.getLegalMentions(),
                offer.getCreatedById(),
                offer.getEnrichedById(),
                offer.getCurrentVersion(),
                offer.getCreatedAt(),
                offer.getUpdatedAt(),
                itemIds
        );
    }
}
