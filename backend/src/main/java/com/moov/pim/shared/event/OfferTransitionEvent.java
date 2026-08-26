package com.moov.pim.shared.event;

import java.util.UUID;

/**
 * @param assignedToId analyste designe pour l'enrichissement, {@code null} si la
 *                     fiche n'a pas encore ete repartie. Transporte ici pour que
 *                     le module de notification puisse cibler le destinataire
 *                     sans interroger le module du cycle de vie.
 */
public record OfferTransitionEvent(UUID offerId, String offerName, UUID userId, UUID createdById,
                                   String fromStatus, String toStatus, UUID assignedToId) {}
