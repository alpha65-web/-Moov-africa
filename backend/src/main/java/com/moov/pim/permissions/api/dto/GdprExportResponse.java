package com.moov.pim.permissions.api.dto;

import com.moov.pim.analytics.api.dto.AuditLogResponse;

import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

public record GdprExportResponse(
        LocalDateTime exportedAt,
        String format,
        UserProfileData profile,
        List<AuditLogResponse> activityLog,
        List<MediaAssetData> uploadedMedia
) {
    public record UserProfileData(
            UUID id,
            String email,
            String firstName,
            String lastName,
            String role,
            String status,
            boolean totpEnabled,
            LocalDateTime lastLoginAt,
            LocalDateTime createdAt,
            LocalDateTime updatedAt
    ) {}

    public record MediaAssetData(
            UUID id,
            String fileName,
            String mimeType,
            long fileSize,
            LocalDateTime createdAt
    ) {}
}
