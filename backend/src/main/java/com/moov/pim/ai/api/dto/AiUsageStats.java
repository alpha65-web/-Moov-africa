package com.moov.pim.ai.api.dto;

import java.util.Map;

public record AiUsageStats(
    long totalRequests,
    long successfulRequests,
    long failedRequests,
    long totalInputTokens,
    long totalOutputTokens,
    double avgLatencyMs,
    Map<String, Long> requestsByTask,
    Map<String, Long> requestsByDay
) {}
