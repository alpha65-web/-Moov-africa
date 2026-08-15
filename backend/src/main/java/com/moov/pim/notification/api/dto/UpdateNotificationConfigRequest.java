package com.moov.pim.notification.api.dto;

import jakarta.validation.constraints.NotNull;

public record UpdateNotificationConfigRequest(
        @NotNull Boolean enabled,
        String channel
) {}
