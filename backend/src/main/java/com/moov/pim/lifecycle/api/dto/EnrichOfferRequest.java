package com.moov.pim.lifecycle.api.dto;

public record EnrichOfferRequest(
        String shortDescription,
        String longDescription,
        String seoTitle,
        String seoDescription,
        String legalMentions
) {}
