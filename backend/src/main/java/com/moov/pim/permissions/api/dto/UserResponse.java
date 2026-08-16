package com.moov.pim.permissions.api.dto;

import com.moov.pim.permissions.domain.User;

import java.time.LocalDateTime;
import java.util.UUID;

public record UserResponse(
        UUID id,
        String email,
        String firstName,
        String lastName,
        String role,
        String status,
        boolean forcePasswordChange,
        boolean totpEnabled,
        LocalDateTime lastLoginAt,
        LocalDateTime createdAt
) {
    public static UserResponse from(User user) {
        return new UserResponse(
                user.getId(),
                user.getEmail(),
                user.getFirstName(),
                user.getLastName(),
                user.getRole().getName().name(),
                user.getStatus().name(),
                user.isForcePasswordChange(),
                user.isTotpEnabled(),
                user.getLastLoginAt(),
                user.getCreatedAt()
        );
    }
}
