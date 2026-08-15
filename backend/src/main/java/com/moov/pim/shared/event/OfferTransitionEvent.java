package com.moov.pim.shared.event;

import java.util.UUID;

public record OfferTransitionEvent(UUID offerId, String offerName, UUID userId, String fromStatus, String toStatus) {}
