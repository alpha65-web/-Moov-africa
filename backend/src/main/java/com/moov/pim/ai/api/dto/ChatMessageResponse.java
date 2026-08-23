package com.moov.pim.ai.api.dto;

import java.time.LocalDateTime;
import java.util.UUID;

public record ChatMessageResponse(
    UUID id,
    String role,
    String content,
    LocalDateTime createdAt
) {}
