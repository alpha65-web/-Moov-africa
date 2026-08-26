package com.moov.pim.lifecycle.api.dto;

import com.moov.pim.lifecycle.domain.CustomerType;
import com.moov.pim.lifecycle.domain.TargetSegment;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

public record CreateOfferRequest(
        @NotBlank String name,
        /**
         * Categorie ou sous-categorie de type OFFER, obligatoire.
         *
         * L'offre commerciale est le type OFFRE de la classification : « Smart 1 Go »
         * se range sous Internet mobile / Forfaits Data. Sans elle, l'offre reste
         * introuvable par type et par categorie, ce qui est la premiere attente d'un
         * referentiel produit.
         */
        @NotNull UUID categoryId,
        String shortDescription,
        String longDescription,
        BigDecimal promotionalPrice,
        // Le formulaire de creation propose un selecteur de devise depuis toujours,
        // mais la requete ne la transportait pas : toute offre restait en XOF, la
        // valeur par defaut de l'entite, quel que soit le choix de l'utilisateur.
        String currency,
        LocalDateTime validFrom,
        LocalDateTime validUntil,
        TargetSegment targetSegment,
        CustomerType customerType,
        String legalMentions,
        List<UUID> catalogItemIds
) {}
