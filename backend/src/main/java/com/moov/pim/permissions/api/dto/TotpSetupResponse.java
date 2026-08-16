package com.moov.pim.permissions.api.dto;

public record TotpSetupResponse(
        String secret,
        String otpAuthUri
) {}
