package com.moov.pim.ai.api.dto;

/**
 * @param content  texte produit
 * @param source   origine des donnees ayant servi a la generation
 */
public record AiGenerationResponse(
        String type,
        String tone,
        String language,
        String content,
        String source
) {}
