package com.moov.pim.shared.event;

import java.util.UUID;

public record CatalogItemCreatedEvent(UUID itemId, String itemName, String itemType, UUID userId) {}
