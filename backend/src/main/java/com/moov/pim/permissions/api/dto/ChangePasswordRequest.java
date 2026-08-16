package com.moov.pim.permissions.api.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record ChangePasswordRequest(
        @NotBlank String currentPassword,
        @NotBlank @Size(min = 12, message = "Le mot de passe doit contenir au moins 12 caractères") String newPassword
) {}
