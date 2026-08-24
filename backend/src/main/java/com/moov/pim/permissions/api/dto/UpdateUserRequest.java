package com.moov.pim.permissions.api.dto;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;

public record UpdateUserRequest(
        @Email String email,
        @NotBlank String firstName,
        @NotBlank String lastName,
        String sex,
        String phone,
        String pseudo,
        String address,
        // Data URI (data:image/...;base64,...) redimensionnee par le navigateur.
        String avatarUrl,
        String roleName,
        // Optionnel : renseigne uniquement lorsque l'administrateur reinitialise le mot de passe.
        String password
) {}
