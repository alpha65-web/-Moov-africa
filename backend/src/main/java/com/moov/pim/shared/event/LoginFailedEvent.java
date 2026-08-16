package com.moov.pim.shared.event;

import java.util.UUID;

public record LoginFailedEvent(UUID userId, String email, String reason, String ipAddress, String userAgent) {}
