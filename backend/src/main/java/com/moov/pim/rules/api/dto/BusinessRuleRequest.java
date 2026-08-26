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
        @NotNull UUID targetItemId,
        /**
         * Nul vaut « bloquante ». Une regle metier declaree est une contrainte :
         * c'est a son auteur de la relacher explicitement s'il veut seulement
         * avertir, pas au systeme de supposer qu'elle est facultative.
         */
        Boolean blocking
) {
    public boolean blockingOrDefault() {
        return blocking == null || blocking;
    }
}
