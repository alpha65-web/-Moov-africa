package com.moov.pim.ai.api.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import java.util.UUID;

public record TranslationRequest(
    @NotNull UUID offerId,
    @NotBlank String targetLanguage
) {}
