package com.moov.pim.shared.event;

import java.util.UUID;

public record UserLoginEvent(UUID userId, String email, String ipAddress, String userAgent) {}
