package com.moov.pim.shared.event;

import java.util.UUID;

public record OfferCreatedEvent(UUID offerId, String offerName, UUID userId) {}
