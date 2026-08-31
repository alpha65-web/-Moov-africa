package com.moov.pim.ai.api.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

/**
 * Fiche technique soumise a l'extraction.
 *
 * @param content  texte de la fiche, colle ou lu depuis un fichier texte
 * @param itemType PRODUCT, SERVICE ou PACK. Il borne les categories proposees :
 *                 une categorie appartient a un et un seul type, et proposer
 *                 « Forfaits Data » pour un routeur serait une classification
 *                 fausse, pas une suggestion perfectible.
 */
public record SheetExtractionRequest(
        @NotBlank @Size(max = 50_000) String content,
        String itemType
) {}
