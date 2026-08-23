package com.moov.pim.ai.api.dto;

import java.math.BigDecimal;
import java.util.List;

public record PricingSuggestion(
    BigDecimal suggestedPrice,
    BigDecimal minPrice,
    BigDecimal maxPrice,
    String currency,
    String rationale,
    List<PricePoint> pricePoints
) {
    public record PricePoint(
        String label,
        BigDecimal price,
        String description
    ) {}
}
