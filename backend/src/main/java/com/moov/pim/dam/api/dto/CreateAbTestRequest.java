package com.moov.pim.dam.api.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

import java.util.UUID;

public record CreateAbTestRequest(
        @NotNull UUID offerId,
        @NotBlank String variantA,
        @NotBlank String variantB,
        @NotBlank String metric
) {}
