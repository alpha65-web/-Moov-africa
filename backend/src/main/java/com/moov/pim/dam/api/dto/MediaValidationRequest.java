package com.moov.pim.dam.api.dto;

import com.moov.pim.dam.domain.AssetMediaType;
import com.moov.pim.dam.domain.ValidationStatus;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

/**
 * Decision du chef de service sur un visuel.
 *
 * @param annotation motif de la decision. Le cahier des charges (7.6) exige une
 *                   « annotation detaillee selon le type de media », et elle est
 *                   obligatoire en cas de rejet : c'est elle qui dit a l'analyste
 *                   marketing ce qu'il doit corriger avant de redeposer. L'ecran
 *                   envoyait jusqu'ici un libelle generique fabrique par le
 *                   frontend — un commentaire d'apparence humaine qui n'etait
 *                   qu'une constante d'interface, et qui ne renseignait personne.
 * @param mediaType  nature du visuel juge. Les criteres ne sont pas les memes
 *                   pour une image, une video et une notice PDF.
 */
public record MediaValidationRequest(
        @NotNull ValidationStatus status,
        @Size(max = 2000) String annotation,
        @NotNull AssetMediaType mediaType
) {}
