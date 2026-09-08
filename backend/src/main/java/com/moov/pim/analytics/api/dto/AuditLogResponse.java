package com.moov.pim.analytics.api.dto;

import com.moov.pim.analytics.domain.AuditLog;

import java.time.LocalDateTime;
import java.util.UUID;

public record AuditLogResponse(
        UUID id,
        UUID userId,
        /** Nom de l'auteur de l'action ; nul pour une action systeme ou un compte supprime. */
        String userName,
        String action,
        String entityType,
        UUID entityId,
        String previousValue,
        String newValue,
        String ipAddress,
        String userAgent,
        LocalDateTime createdAt
) {
    public static AuditLogResponse from(AuditLog log) {
        return from(log, null);
    }

    public static AuditLogResponse from(AuditLog log, String userName) {
        return new AuditLogResponse(
                log.getId(), log.getUserId(), userName, log.getAction().name(),
                log.getEntityType(), log.getEntityId(),
                log.getPreviousValue(), log.getNewValue(),
                log.getIpAddress(), log.getUserAgent(), log.getCreatedAt()
        );
    }
}
