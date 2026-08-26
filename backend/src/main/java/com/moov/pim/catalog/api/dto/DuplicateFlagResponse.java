package com.moov.pim.catalog.api.dto;

import com.moov.pim.catalog.domain.DuplicateFlag;

import java.time.LocalDateTime;
import java.util.Map;
import java.util.UUID;

/**
 * Rapprochement de doublon soumis a l'arbitrage du chef de produit.
 *
 * Porte les deux libelles en clair et non les seuls identifiants : un ecran qui
 * afficherait « e1000000-… ressemble a e1000000-… » ne permettrait de trancher
 * qu'en ouvrant les deux fiches.
 */
public record DuplicateFlagResponse(
        UUID id,
        UUID sourceProductId,
        String sourceProductName,
        UUID duplicateProductId,
        String duplicateProductName,
        /** Similarite des deux libelles, entre 0 et 1. */
        float similarityScore,
        LocalDateTime createdAt
) {
    public static DuplicateFlagResponse from(DuplicateFlag flag, Map<UUID, String> productNames) {
        return new DuplicateFlagResponse(
                flag.getId(),
                flag.getSourceProductId(),
                productNames.get(flag.getSourceProductId()),
                flag.getDuplicateProductId(),
                productNames.get(flag.getDuplicateProductId()),
                flag.getSimilarityScore(),
                flag.getCreatedAt()
        );
    }
}
