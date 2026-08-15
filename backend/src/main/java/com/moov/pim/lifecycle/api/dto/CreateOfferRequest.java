package com.moov.pim.lifecycle.api.dto;

import com.moov.pim.lifecycle.domain.CustomerType;
import com.moov.pim.lifecycle.domain.TargetSegment;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

public record CreateOfferRequest(
        @NotBlank String name,
        String shortDescription,
        String longDescription,
        BigDecimal promotionalPrice,
        LocalDateTime validFrom,
        LocalDateTime validUntil,
        TargetSegment targetSegment,
        CustomerType customerType,
        String legalMentions,
        @NotEmpty List<UUID> catalogItemIds
) {}
