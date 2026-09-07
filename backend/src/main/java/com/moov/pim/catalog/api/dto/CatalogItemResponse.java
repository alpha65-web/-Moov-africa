package com.moov.pim.catalog.api.dto;

import com.moov.pim.catalog.domain.CatalogItem;
import com.moov.pim.catalog.domain.Pack;
import com.moov.pim.catalog.domain.Product;
import com.moov.pim.catalog.domain.Service;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;
import java.util.UUID;

public record CatalogItemResponse(
        UUID id,
        String type,
        String name,
        String description,
        String status,
        BigDecimal basePrice,
        String currency,
        UUID categoryId,
        /**
         * Chemin de classement lisible : « Équipements / Routeurs ».
         *
         * Le tableau du catalogue affichait l'identifiant technique de la
         * categorie faute de libelle disponible, et l'interface entretenait a cote
         * une liste de libelles en dur sans rapport avec l'arborescence reelle.
         * Nul quand la categorie n'a pas ete resolue par l'appelant.
         */
        String categoryPath,
        LocalDateTime createdAt,
        Map<String, Object> details,
        /**
         * Auteur de la brique, en clair. Nul lorsque le demandeur n'a pas a le
         * connaitre.
         *
         * Le cahier des charges impose que le chef de service « voit qui a cree
         * quelle offre/produit » (l. 114) et interdit que les chefs de produit
         * entre eux le voient (l. 115). Le catalogue ne portait que createdById,
         * un identifiant technique qu'aucun ecran ne resolvait.
         */
        String createdByName
) {
    public static CatalogItemResponse from(CatalogItem item) {
        return from(item, Map.of(), Map.of());
    }

    public static CatalogItemResponse from(CatalogItem item, Map<UUID, String> names) {
        return from(item, names, Map.of());
    }

    /**
     * @param names          identites resolues, par identifiant de compte. Une
     *                       entree absente laisse le nom nul : c'est ainsi que le
     *                       perimetre de divulgation s'applique, sans que ce DTO
     *                       connaisse les regles.
     * @param categoryPaths  chemins de classement resolus, par identifiant de
     *                       categorie.
     */
    public static CatalogItemResponse from(CatalogItem item,
                                           Map<UUID, String> names,
                                           Map<UUID, String> categoryPaths) {
        Map<String, Object> details;
        String type;

        if (item instanceof Product p) {
            type = "PRODUCT";
            details = Map.of(
                    "characteristics", p.getCharacteristics() != null ? p.getCharacteristics() : "{}",
                    "packOnly", p.isPackOnly()
            );
        } else if (item instanceof Service s) {
            type = "SERVICE";
            details = Map.of(
                    "serviceType", s.getServiceType().name(),
                    "billingCycle", s.getBillingCycle().name(),
                    "characteristics", s.getCharacteristics() != null ? s.getCharacteristics() : "{}",
                    "packOnly", s.isPackOnly()
            );
        } else if (item instanceof Pack pk) {
            type = "PACK";
            List<Map<String, Object>> packItems = pk.getItems().stream()
                    .map(pi -> Map.<String, Object>of(
                            "catalogItemId", pi.getCatalogItemId(),
                            "quantity", pi.getQuantity()))
                    .toList();
            details = Map.of(
                    "bundlePrice", pk.getBundlePrice() != null ? pk.getBundlePrice() : BigDecimal.ZERO,
                    "bundleDiscount", pk.getBundleDiscount() != null ? pk.getBundleDiscount() : BigDecimal.ZERO,
                    "items", packItems
            );
        } else {
            type = "UNKNOWN";
            details = Map.of();
        }

        return new CatalogItemResponse(
                item.getId(), type, item.getName(), item.getDescription(),
                item.getStatus().name(), item.getBasePrice(), item.getCurrency(),
                item.getCategoryId(),
                // Map.of() refuse une cle nulle ; la lecture ne doit pas dependre
                // de la presence d'une categorie.
                item.getCategoryId() != null ? categoryPaths.get(item.getCategoryId()) : null,
                item.getCreatedAt(), details,
                names.get(item.getCreatedById())
        );
    }
}
