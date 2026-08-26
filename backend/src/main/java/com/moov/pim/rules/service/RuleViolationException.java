package com.moov.pim.rules.service;

import com.moov.pim.rules.api.dto.RuleViolation;

import java.util.List;

/**
 * Composition refusee parce qu'elle viole une ou plusieurs regles bloquantes.
 *
 * Porte la liste complete des violations et non un simple message : l'ecran doit
 * pouvoir nommer chaque regle en cause. Un refus qui se contente de dire
 * « composition invalide » laisse le chef de produit chercher lui-meme laquelle
 * de ses briques pose probleme.
 */
public class RuleViolationException extends RuntimeException {

    private final transient List<RuleViolation> violations;

    public RuleViolationException(List<RuleViolation> violations) {
        super(violations.stream()
                .map(RuleViolation::message)
                .reduce((a, b) -> a + " | " + b)
                .orElse("Composition invalide"));
        this.violations = List.copyOf(violations);
    }

    public List<RuleViolation> getViolations() {
        return violations;
    }
}
