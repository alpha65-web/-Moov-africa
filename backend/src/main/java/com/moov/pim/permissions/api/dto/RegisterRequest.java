package com.moov.pim.permissions.api.dto;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

public record RegisterRequest(
        @NotBlank @Email String email,
        @NotBlank @Size(min = 12, message = "Le mot de passe doit contenir au moins 12 caractères") String password,
        @NotBlank String firstName,
        @NotBlank String lastName,
        @NotNull String roleName
) {}
