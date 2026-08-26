package com.moov.pim.catalog.api.dto;

import jakarta.validation.constraints.NotBlank;

import java.util.UUID;

/**
 * Creation ou modification d'une categorie.
 *
 * {@code type} n'est exige que pour une categorie racine : une sous-categorie
 * herite obligatoirement du type de son parent, et le fournir differemment est
 * refuse plutot qu'ignore silencieusement. Il est declare en {@code String} et
 * non en enumeration afin que le service puisse rendre un message explicite sur
 * les valeurs attendues, plutot qu'un 400 de deserialisation.
 */
public record CategoryRequest(
        @NotBlank String name,
        String description,
        String type,
        UUID parentId
) {}
