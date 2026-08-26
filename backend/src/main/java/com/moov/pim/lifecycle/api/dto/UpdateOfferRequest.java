package com.moov.pim.lifecycle.api.dto;

import com.moov.pim.lifecycle.domain.CustomerType;
import com.moov.pim.lifecycle.domain.TargetSegment;
import jakarta.validation.constraints.NotBlank;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

/**
 * Champs commerciaux d'une offre, propriete du chef de produit.
 *
 * Le service n'exposait que la creation et l'enrichissement. Le chef de produit
 * ne pouvait donc plus toucher a sa fiche une fois creee, alors que le cahier des
 * charges lui confie explicitement la « correction/resoumission en cas de rejet »
 * (l. 103 et l. 150). Faute d'endpoint, l'interface reutilisait le formulaire
 * d'enrichissement, qui ignore silencieusement ces champs.
 *
 * La separation est deliberement faite au niveau du champ et non de l'entite :
 * les descriptions, le referencement et les medias restent hors de portee ici,
 * ils appartiennent a l'analyste marketing et passent par /enrich.
 */
public record UpdateOfferRequest(
        @NotBlank String name,
        /**
         * Reclassement de l'offre. Champ commercial : il appartient au chef de
         * produit, au meme titre que le prix ou les dates de validite, et non a
         * l'analyste marketing qui n'intervient que sur l'editorial.
         *
         * Nul laisse la categorie inchangee : une requete qui ne s'interesse qu'au
         * prix ne doit pas declasser l'offre.
         */
        UUID categoryId,
        BigDecimal promotionalPrice,
        String currency,
        LocalDateTime validFrom,
        LocalDateTime validUntil,
        TargetSegment targetSegment,
        CustomerType customerType,
        String legalMentions,
        List<UUID> catalogItemIds
) {}
