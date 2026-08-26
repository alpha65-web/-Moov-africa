package com.moov.pim.lifecycle.api.dto;

import com.moov.pim.lifecycle.domain.Offer;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

public record OfferResponse(
        UUID id,
        String name,
        String shortDescription,
        String longDescription,
        String seoTitle,
        String seoDescription,
        String status,
        /** Categorie ou sous-categorie de classement. Nulle pour les offres anterieures a la classification. */
        UUID categoryId,
        /** Chemin de classement lisible : « Internet mobile / Forfaits Data ». */
        String categoryPath,
        BigDecimal promotionalPrice,
        String currency,
        LocalDateTime validFrom,
        LocalDateTime validUntil,
        String targetSegment,
        String customerType,
        float qualityScore,
        LocalDateTime publishDate,
        String legalMentions,
        UUID createdById,
        UUID enrichedById,
        /** Analyste designe pour l'enrichissement ; nul tant que l'offre n'est pas repartie. */
        UUID assignedToId,
        long currentVersion,
        LocalDateTime createdAt,
        LocalDateTime updatedAt,
        List<UUID> catalogItemIds,
        /**
         * Auteur de la fiche, en clair. Nul lorsque le demandeur n'a pas a le
         * connaitre.
         *
         * Le cahier des charges impose que « le chef de service a une vue
         * transversale sur plusieurs chefs de produit et voit qui a cree quelle
         * offre » (l. 114), tout en interdisant que « les chefs de produit entre eux
         * voient qui a cree quel produit » (l. 115). Seul createdById existait, un
         * identifiant technique qu'aucun ecran ne resolvait : la capacite qui
         * distingue le chef de service des autres valideurs etait donc invisible.
         */
        String createdByName,
        /** Analyste designe, en clair. Meme regle de divulgation que l'auteur. */
        String assignedToName
) {
    public static OfferResponse from(Offer offer) {
        return from(offer, java.util.Map.of(), java.util.Map.of());
    }

    public static OfferResponse from(Offer offer, java.util.Map<UUID, String> names) {
        return from(offer, names, java.util.Map.of());
    }

    /**
     * @param names identites resolues, par identifiant de compte. Une entree
     *              absente laisse le nom nul : c'est ainsi que le perimetre de
     *              divulgation est applique, sans que ce DTO ait a connaitre les
     *              regles de visibilite.
     */
    public static OfferResponse from(Offer offer,
                                     java.util.Map<UUID, String> names,
                                     java.util.Map<UUID, String> categoryPaths) {
        List<UUID> itemIds = offer.getItems().stream()
                .map(item -> item.getCatalogItemId())
                .toList();

        return new OfferResponse(
                offer.getId(),
                offer.getName(),
                offer.getShortDescription(),
                offer.getLongDescription(),
                offer.getSeoTitle(),
                offer.getSeoDescription(),
                offer.getStatus().name(),
                offer.getCategoryId(),
                // Map.of() est immuable et refuse une cle nulle : une offre creee
                // avant la classification n'a pas de categorie, la lecture doit le
                // supporter plutot que d'echouer.
                offer.getCategoryId() != null ? categoryPaths.get(offer.getCategoryId()) : null,
                offer.getPromotionalPrice(),
                offer.getCurrency(),
                offer.getValidFrom(),
                offer.getValidUntil(),
                offer.getTargetSegment() != null ? offer.getTargetSegment().name() : null,
                offer.getCustomerType() != null ? offer.getCustomerType().name() : null,
                offer.getQualityScore(),
                offer.getPublishDate(),
                offer.getLegalMentions(),
                offer.getCreatedById(),
                offer.getEnrichedById(), offer.getAssignedToId(),
                offer.getCurrentVersion(),
                offer.getCreatedAt(),
                offer.getUpdatedAt(),
                itemIds,
                names.get(offer.getCreatedById()),
                offer.getAssignedToId() != null ? names.get(offer.getAssignedToId()) : null
        );
    }
}
