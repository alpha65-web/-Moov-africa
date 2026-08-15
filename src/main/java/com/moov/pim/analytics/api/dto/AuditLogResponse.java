package com.moov.pim.analytics.api.dto;

import com.moov.pim.analytics.domain.AuditLog;

import java.time.LocalDateTime;
import java.util.UUID;

public record AuditLogResponse(
        UUID id,
        UUID userId,
        String action,
        String entityType,
        UUID entityId,
        String previousValue,
        String newValue,
        String ipAddress,
        LocalDateTime createdAt
) {
    public static AuditLogResponse from(AuditLog log) {
        return new AuditLogResponse(
                log.getId(), log.getUserId(), log.getAction().name(),
                log.getEntityType(), log.getEntityId(),
                log.getPreviousValue(), log.getNewValue(),
                log.getIpAddress(), log.getCreatedAt()
        );
    }
}
