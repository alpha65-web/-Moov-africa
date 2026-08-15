package com.moov.pim.notification.api.dto;

import com.moov.pim.notification.domain.NotificationConfig;

import java.time.LocalDateTime;
import java.util.UUID;

public record NotificationConfigResponse(
        UUID id,
        String type,
        String channel,
        boolean enabled,
        UUID updatedById,
        LocalDateTime updatedAt
) {
    public static NotificationConfigResponse from(NotificationConfig c) {
        return new NotificationConfigResponse(
                c.getId(), c.getType().name(), c.getChannel(),
                c.isEnabled(), c.getUpdatedById(), c.getUpdatedAt()
        );
    }
}
