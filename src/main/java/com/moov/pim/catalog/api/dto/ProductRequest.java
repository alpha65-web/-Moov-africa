package com.moov.pim.catalog.api.dto;

import jakarta.validation.constraints.NotBlank;

import java.math.BigDecimal;
import java.util.UUID;

public record ProductRequest(
        @NotBlank String name,
        String description,
        BigDecimal basePrice,
        UUID categoryId,
        String characteristics,
        boolean packOnly
) {}
