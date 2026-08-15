package com.moov.pim.notification.api.dto;

import com.moov.pim.notification.domain.Notification;

import java.time.LocalDateTime;
import java.util.UUID;

public record NotificationResponse(
        UUID id,
        UUID recipientId,
        String type,
        String title,
        String message,
        boolean read,
        UUID relatedOfferId,
        LocalDateTime createdAt
) {
    public static NotificationResponse from(Notification n) {
        return new NotificationResponse(
                n.getId(), n.getRecipientId(), n.getType().name(),
                n.getTitle(), n.getMessage(), n.isRead(),
                n.getRelatedOfferId(), n.getCreatedAt()
        );
    }
}
