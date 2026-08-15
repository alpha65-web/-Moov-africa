package com.moov.pim.catalog.api.dto;

import com.moov.pim.catalog.domain.BillingCycle;
import com.moov.pim.catalog.domain.ServiceType;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

import java.math.BigDecimal;
import java.util.UUID;

public record ServiceRequest(
        @NotBlank String name,
        String description,
        BigDecimal basePrice,
        UUID categoryId,
        @NotNull ServiceType serviceType,
        @NotNull BillingCycle billingCycle,
        String characteristics,
        boolean packOnly
) {}
