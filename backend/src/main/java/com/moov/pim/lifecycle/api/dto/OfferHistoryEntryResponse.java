package com.moov.pim.lifecycle.api.dto;

import com.moov.pim.lifecycle.domain.OfferStatusHistory;

import java.time.LocalDateTime;
import java.util.Map;
import java.util.UUID;

/**
 * Une etape franchie par l'offre : qui, quand, de quel statut vers quel statut,
 * et pour quel motif.
 *
 * La table offer_status_history etait alimentee a chaque transition depuis
 * l'origine, mais aucun endpoint ne la lisait : la tracabilite exigee par le
 * cahier des charges (7.7, « historique des modifications consultable ») existait
 * en base sans etre accessible. Un chef de service ne pouvait pas savoir pourquoi
 * une offre lui revenait, ni un administrateur repondre a « qui a valide quoi ».
 */
public record OfferHistoryEntryResponse(
        UUID id,
        String fromStatus,
        String toStatus,
        String comment,
        UUID changedById,
        /** Nul lorsque le demandeur n'a pas a connaitre l'auteur des actions. */
        String changedByName,
        LocalDateTime createdAt
) {
    public static OfferHistoryEntryResponse from(OfferStatusHistory entry, Map<UUID, String> names) {
        return new OfferHistoryEntryResponse(
                entry.getId(),
                entry.getFromStatus() != null ? entry.getFromStatus().name() : null,
                entry.getToStatus().name(),
                entry.getComment(),
                entry.getChangedById(),
                names.get(entry.getChangedById()),
                entry.getCreatedAt()
        );
    }
}
