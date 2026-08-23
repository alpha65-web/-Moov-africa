package com.moov.pim.ai.api.dto;

import java.util.List;

/**
 * @param topic   sujet reconnu dans la question (catalog, offers, campaigns, quality...)
 * @param answer  reponse redigee a partir des chiffres reels
 * @param facts   couples libelle / valeur ayant servi a construire la reponse
 */
public record AiAssistantResponse(
        String topic,
        String answer,
        List<Fact> facts
) {
    public record Fact(String label, String value) {}
}
