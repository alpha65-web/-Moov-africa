package com.moov.pim.shared.event;

import java.util.UUID;

public record CatalogItemArchivedEvent(UUID itemId, UUID userId) {}
