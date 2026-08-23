package com.moov.pim.ai.api.dto;

public record TranslationResult(
    String sourceLanguage,
    String targetLanguage,
    String translatedName,
    String translatedShortDescription,
    String translatedLongDescription,
    String translatedSeoTitle,
    String translatedSeoDescription
) {}
