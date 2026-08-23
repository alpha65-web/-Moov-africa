package com.moov.pim.shared.event;

import java.util.UUID;

public record AiTaskCompletedEvent(UUID userId, String task, boolean success, String entityName) {}
