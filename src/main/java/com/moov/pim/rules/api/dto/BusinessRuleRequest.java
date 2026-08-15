package com.moov.pim.rules.api.dto;

import com.moov.pim.rules.domain.RuleType;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

import java.util.UUID;

public record BusinessRuleRequest(
        @NotBlank String name,
        String description,
        @NotNull RuleType ruleType,
        @NotNull UUID sourceItemId,
        @NotNull UUID targetItemId
) {}
