package com.moov.pim.permissions.api.dto;

public record LoginResponse(
        String accessToken,
        String refreshToken,
        UserResponse user
) {}
