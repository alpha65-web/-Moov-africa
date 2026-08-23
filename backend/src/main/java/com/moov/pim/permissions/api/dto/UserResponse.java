package com.moov.pim.permissions.api.dto;

import com.moov.pim.permissions.domain.Permission;
import com.moov.pim.permissions.domain.User;

import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

public record UserResponse(
        UUID id,
        String email,
        String firstName,
        String lastName,
        String sex,
        String phone,
        String pseudo,
        String avatarUrl,
        String role,
        List<String> permissions,
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
                user.getSex(),
                user.getPhone(),
                user.getPseudo(),
                user.getAvatarUrl(),
                user.getRole().getName().name(),
                user.getRole().getPermissions().stream()
                        .map(Permission::getCode)
                        .sorted()
                        .toList(),
                user.getStatus().name(),
                user.isForcePasswordChange(),
                user.isTotpEnabled(),
                user.getLastLoginAt(),
                user.getCreatedAt()
        );
    }
}
