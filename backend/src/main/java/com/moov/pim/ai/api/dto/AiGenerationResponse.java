package com.moov.pim.ai.api.dto;

/**
 * @param content        texte produit, presente tel quel a l'utilisateur
 * @param source         origine des donnees ayant servi a la generation
 * @param seoTitle       titre de referencement, renseigne uniquement pour le type SEO
 * @param seoDescription meta-description, renseignee uniquement pour le type SEO
 */
public record AiGenerationResponse(
        String type,
        String tone,
        String language,
        String content,
        String source,
        String seoTitle,
        String seoDescription
) {}
