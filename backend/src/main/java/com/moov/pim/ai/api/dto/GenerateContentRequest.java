package com.moov.pim.ai.api.dto;

import jakarta.validation.constraints.NotNull;
import java.util.UUID;

public record GenerateContentRequest(
    @NotNull UUID offerId,
    String tone,
    String targetAudience,
    String language
) {
    public GenerateContentRequest {
        if (tone == null) tone = "professionnel";
        if (language == null) language = "fr";
    }
}
