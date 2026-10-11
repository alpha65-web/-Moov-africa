package com.moov.pim.permissions.api.dto;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;

/**
 * Corps de la demande deposee depuis l'ecran de connexion.
 *
 * Seule l'adresse est demandee : la personne ne peut precisement plus prouver
 * son identite, et rien d'autre ne serait verifiable a ce stade.
 */
public record PasswordResetRequestCreate(
        @NotBlank @Email String email
) {}
