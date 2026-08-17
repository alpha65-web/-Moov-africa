package com.moov.pim.permissions.api.dto;

import jakarta.validation.constraints.NotBlank;

public record UpdateUserRequest(
        @NotBlank String firstName,
        @NotBlank String lastName,
        String sex,
        String roleName
) {}
