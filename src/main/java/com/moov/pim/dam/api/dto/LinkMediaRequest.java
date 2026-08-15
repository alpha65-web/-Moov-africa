package com.moov.pim.dam.api.dto;

import jakarta.validation.constraints.NotNull;

import java.util.UUID;

public record LinkMediaRequest(
        @NotNull UUID mediaAssetId,
        boolean isPrimary,
        int displayOrder
) {}
