package com.moov.pim.catalog.api.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;

import java.math.BigDecimal;
import java.util.List;
import java.util.UUID;

public record PackRequest(
        @NotBlank String name,
        String description,
        BigDecimal basePrice,
        UUID categoryId,
        BigDecimal bundlePrice,
        BigDecimal bundleDiscount,
        @NotEmpty List<PackItemRequest> items
) {
    public record PackItemRequest(UUID catalogItemId, int quantity) {}
}
