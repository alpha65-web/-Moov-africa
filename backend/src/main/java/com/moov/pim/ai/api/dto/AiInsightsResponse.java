package com.moov.pim.ai.api.dto;

import java.util.List;

/**
 * Photographie de la qualite du referentiel a l'instant de l'appel.
 * Toutes les valeurs sont calculees a partir de la base, aucune n'est simulee.
 *
 * @param qualityScore score global sur 100
 * @param penalties    detail des points retires, pour rendre le score explicable
 */
public record AiInsightsResponse(
        int qualityScore,
        int anomalies,
        int itemsWithoutDescription,
        int suggestions,
        List<AiRecommendation> recommendations,
        List<ScorePenalty> penalties,
        Snapshot snapshot
) {
    /** @param points points retires du score global (valeur positive) */
    public record ScorePenalty(String label, int points) {}

    public record Snapshot(
            long catalogItems,
            long activeCatalogItems,
            long categories,
            long offers,
            long publishedOffers,
            long campaigns,
            long mediaAssets,
            long businessRules
    ) {}
}
