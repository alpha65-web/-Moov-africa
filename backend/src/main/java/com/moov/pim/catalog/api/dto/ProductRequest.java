package com.moov.pim.catalog.api.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

import java.math.BigDecimal;
import java.util.UUID;

public record ProductRequest(
        @NotBlank String name,
        String description,
        BigDecimal basePrice,
        /**
         * Categorie ou sous-categorie de classement, obligatoire.
         *
         * Elle doit etre de type PRODUCT et active : le service le verifie avant
         * enregistrement et la base l'impose par une cle etrangere composite vers
         * categories(id, type). Le formulaire envoyait jusqu'ici un libelle pris
         * dans une liste codee en dur, que l'API ne pouvait pas interpreter.
         */
        @NotNull UUID categoryId,
        String characteristics,
        boolean packOnly
) {}
