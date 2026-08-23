package com.moov.pim.shared.event;

import java.util.UUID;

public record MediaValidatedEvent(UUID mediaAssetId, String fileName, UUID validatedById, boolean approved) {}
