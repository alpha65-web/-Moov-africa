package com.moov.pim.dam.api.dto;

import com.moov.pim.dam.domain.AssetMediaType;
import com.moov.pim.dam.domain.ValidationStatus;
import jakarta.validation.constraints.NotNull;

public record MediaValidationRequest(
        @NotNull ValidationStatus status,
        String annotation,
        @NotNull AssetMediaType mediaType
) {}
