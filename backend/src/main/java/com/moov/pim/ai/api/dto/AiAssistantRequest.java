package com.moov.pim.ai.api.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record AiAssistantRequest(
        @NotBlank @Size(max = 500) String question
) {}
