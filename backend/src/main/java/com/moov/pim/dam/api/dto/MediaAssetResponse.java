package com.moov.pim.dam.api.dto;

import com.moov.pim.dam.domain.MediaAsset;

import java.time.LocalDateTime;
import java.util.UUID;

public record MediaAssetResponse(
        UUID id,
        String fileName,
        String mimeType,
        long fileSize,
        String storageKey,
        int width,
        int height,
        int resolution,
        String conformityStatus,
        boolean copyrightRisk,
        UUID parentMediaId,
        int mediaVersion,
        UUID uploadedById,
        LocalDateTime createdAt
) {
    public static MediaAssetResponse from(MediaAsset asset) {
        return new MediaAssetResponse(
                asset.getId(), asset.getFileName(), asset.getMimeType(),
                asset.getFileSize(), asset.getStorageKey(),
                asset.getWidth(), asset.getHeight(), asset.getResolution(),
                asset.getConformityStatus().name(), asset.isCopyrightRisk(),
                asset.getParentMediaId(), asset.getMediaVersion(),
                asset.getUploadedById(), asset.getCreatedAt()
        );
    }
}
