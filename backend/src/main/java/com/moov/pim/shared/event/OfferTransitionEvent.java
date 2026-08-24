package com.moov.pim.shared.event;

import java.util.UUID;

public record OfferTransitionEvent(UUID offerId, String offerName, UUID userId, UUID createdById,
                                   String fromStatus, String toStatus) {}
