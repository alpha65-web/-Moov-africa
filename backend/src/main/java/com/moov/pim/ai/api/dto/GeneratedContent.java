package com.moov.pim.ai.api.dto;

public record GeneratedContent(
    String shortDescription,
    String longDescription,
    String seoTitle,
    String seoDescription,
    String legalMentions,
    String marketingSlogan
) {}
