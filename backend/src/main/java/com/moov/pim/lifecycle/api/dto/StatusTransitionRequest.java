package com.moov.pim.lifecycle.api.dto;

import com.moov.pim.lifecycle.domain.OfferStatus;
import jakarta.validation.constraints.NotNull;

public record StatusTransitionRequest(
        @NotNull OfferStatus targetStatus,
        String comment
) {}
