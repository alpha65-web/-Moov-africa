package com.moov.pim.ai.domain;

import java.util.List;

public record AnomalyReport(
    int totalChecked,
    int anomalyCount,
    List<Anomaly> anomalies
) {
    public record Anomaly(
        String entityId,
        String entityName,
        String type,
        String severity,
        String description,
        String recommendation
    ) {}
}
