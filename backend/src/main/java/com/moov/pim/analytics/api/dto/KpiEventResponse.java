package com.moov.pim.analytics.api.dto;

import com.moov.pim.analytics.domain.KpiEvent;

import java.time.LocalDateTime;
import java.util.UUID;

/**
 * Evenement du flux KPI.
 *
 * Les identifiants restent presents pour les filtres, mais l'ecran affiche les
 * noms : une colonne d'identifiants tronques ne dit rien a un chef de
 * departement. Le nom d'acteur est nul si le compte a ete supprime ou si le
 * demandeur n'a pas a le connaitre.
 */
public record KpiEventResponse(
        UUID id,
        UUID offerId,
        String offerName,
        String eventType,
        UUID actorId,
        String actorName,
        Long durationMs,
        LocalDateTime createdAt
) {
    public static KpiEventResponse from(KpiEvent e, String offerName, String actorName) {
        return new KpiEventResponse(
                e.getId(), e.getOfferId(), offerName, e.getEventType(),
                e.getActorId(), actorName, e.getDurationMs(), e.getCreatedAt()
        );
    }
}
