package com.moov.pim.analytics.api.dto;

import com.moov.pim.analytics.domain.KpiEvent;

import java.time.LocalDateTime;
import java.util.UUID;

public record KpiEventResponse(
        UUID id,
        UUID offerId,
        String eventType,
        UUID actorId,
        Long durationMs,
        LocalDateTime createdAt
) {
    public static KpiEventResponse from(KpiEvent e) {
        return new KpiEventResponse(
                e.getId(), e.getOfferId(), e.getEventType(),
                e.getActorId(), e.getDurationMs(), e.getCreatedAt()
        );
    }
}
