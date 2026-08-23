package com.moov.pim.ai.domain;

import java.util.List;

public record QualityReport(
    int overallScore,
    String grade,
    List<Criterion> criteria,
    List<String> suggestions
) {
    public record Criterion(
        String name,
        int score,
        int maxScore,
        String feedback
    ) {}
}
