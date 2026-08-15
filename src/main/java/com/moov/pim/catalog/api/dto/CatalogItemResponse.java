package com.moov.pim.catalog.api.dto;

import com.moov.pim.catalog.domain.CatalogItem;
import com.moov.pim.catalog.domain.Pack;
import com.moov.pim.catalog.domain.Product;
import com.moov.pim.catalog.domain.Service;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;
import java.util.UUID;

public record CatalogItemResponse(
        UUID id,
        String type,
        String name,
        String description,
        String status,
        BigDecimal basePrice,
        String currency,
        UUID categoryId,
        LocalDateTime createdAt,
        Map<String, Object> details
) {
    public static CatalogItemResponse from(CatalogItem item) {
        Map<String, Object> details;
        String type;

        if (item instanceof Product p) {
            type = "PRODUCT";
            details = Map.of(
                    "characteristics", p.getCharacteristics() != null ? p.getCharacteristics() : "{}",
                    "packOnly", p.isPackOnly(),
                    "qualityScore", p.getQualityScore()
            );
        } else if (item instanceof Service s) {
            type = "SERVICE";
            details = Map.of(
                    "serviceType", s.getServiceType().name(),
                    "billingCycle", s.getBillingCycle().name(),
                    "characteristics", s.getCharacteristics() != null ? s.getCharacteristics() : "{}",
                    "packOnly", s.isPackOnly()
            );
        } else if (item instanceof Pack pk) {
            type = "PACK";
            List<Map<String, Object>> packItems = pk.getItems().stream()
                    .map(pi -> Map.<String, Object>of(
                            "catalogItemId", pi.getCatalogItemId(),
                            "quantity", pi.getQuantity()))
                    .toList();
            details = Map.of(
                    "bundlePrice", pk.getBundlePrice() != null ? pk.getBundlePrice() : BigDecimal.ZERO,
                    "bundleDiscount", pk.getBundleDiscount() != null ? pk.getBundleDiscount() : BigDecimal.ZERO,
                    "items", packItems
            );
        } else {
            type = "UNKNOWN";
            details = Map.of();
        }

        return new CatalogItemResponse(
                item.getId(), type, item.getName(), item.getDescription(),
                item.getStatus().name(), item.getBasePrice(), item.getCurrency(),
                item.getCategoryId(), item.getCreatedAt(), details
        );
    }
}
