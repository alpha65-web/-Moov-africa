package com.moov.pim.ai.api.dto;

import java.math.BigDecimal;
import java.util.List;
import java.util.UUID;

/**
 * Proposition issue de la lecture d'une fiche technique.
 *
 * Une proposition, et non une creation : le chef de produit relit, corrige et
 * valide avant que quoi que ce soit n'entre au catalogue. Une extraction qui
 * creerait l'element directement lui ferait porter des valeurs qu'il n'a pas
 * choisies, et une erreur de lecture deviendrait une donnee de reference.
 *
 * Chaque champ non reconnu reste nul plutot que rempli d'une valeur plausible :
 * un champ vide se voit et se complete, une valeur inventee se recopie.
 *
 * @param categoryPath  chemin lisible de la categorie retenue, pour que le chef
 *                      de produit voie ou son element serait range sans avoir a
 *                      deplier l'arborescence
 * @param notes         ce que la lecture a reconnu et ce qu'elle n'a pas trouve,
 *                      en clair. C'est ce qui distingue une extraction verifiable
 *                      d'un formulaire prerempli par magie.
 */
public record SheetExtractionResponse(
        String name,
        String itemType,
        String serviceType,
        String billingCycle,
        BigDecimal basePrice,
        String currency,
        UUID categoryId,
        String categoryPath,
        String characteristics,
        List<String> tags,
        List<String> notes
) {}
