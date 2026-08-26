package com.moov.pim.lifecycle.api.dto;

import com.moov.pim.lifecycle.domain.OfferVersion;

import java.time.LocalDateTime;
import java.util.Map;
import java.util.UUID;

/**
 * Un etat anterieur complet de la fiche, restaurable par l'administrateur.
 *
 * offer_versions etait ecrite a chaque transition depuis l'origine, mais rien ne
 * la lisait et aucune restauration n'existait. Le cahier des charges (7.7) exige
 * pourtant que l'historique soit « consultable en integralite par l'administrateur
 * (avec rollback) » : la moitie de la fonction — l'ecriture — etait faite, l'autre
 * moitie n'avait jamais ete ecrite.
 *
 * @param snapshot etat serialise de la fiche a ce moment-la, au format JSON.
 */
public record OfferVersionResponse(
        UUID id,
        long versionNumber,
        String snapshot,
        String changeDescription,
        UUID changedById,
        /** Nul lorsque le demandeur n'a pas a connaitre l'auteur des actions. */
        String changedByName,
        LocalDateTime createdAt
) {
    public static OfferVersionResponse from(OfferVersion version, Map<UUID, String> names) {
        return new OfferVersionResponse(
                version.getId(),
                version.getVersionNumber(),
                version.getSnapshot(),
                version.getChangeDescription(),
                version.getChangedById(),
                names.get(version.getChangedById()),
                version.getCreatedAt()
        );
    }
}
