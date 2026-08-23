package com.moov.pim.ai.api.dto;

import java.util.List;
import java.util.UUID;

/**
 * Recommandation deduite de l'etat reel de la base.
 *
 * @param code       identifiant stable de la regle d'analyse
 * @param priority   HIGH, MEDIUM ou LOW
 * @param category   module concerne (catalog, offers, media, categories, rules, campaigns)
 * @param title      libelle court
 * @param detail     explication chiffree
 * @param impact     nombre d'elements concernes
 * @param entityIds  identifiants des elements concernes (limites aux 20 premiers)
 */
public record AiRecommendation(
        String code,
        String priority,
        String category,
        String title,
        String detail,
        int impact,
        List<UUID> entityIds
) {
    public static final String HIGH = "HIGH";
    public static final String MEDIUM = "MEDIUM";
    public static final String LOW = "LOW";
}
