package com.moov.pim.dam.api.dto;

import com.moov.pim.dam.domain.MediaAsset;

import java.time.LocalDateTime;
import java.util.UUID;

/**
 * Fiche d'un media, telle que la mediatheque et le circuit de validation
 * graphique la presentent.
 *
 * {@code conformityReport} porte le constat d'inspection en clair. Sans lui, le
 * chef de service disposait du seul statut de conformite, sans savoir ce qui
 * l'avait produit : il devait juger « le format, la resolution et les droits
 * d'auteur » (cahier des charges 7.6) a l'oeil nu.
 */
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
        String copyrightNotice,
        String conformityReport,
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
                asset.getCopyrightNotice(), asset.getConformityReport(),
                asset.getParentMediaId(), asset.getMediaVersion(),
                asset.getUploadedById(), asset.getCreatedAt()
        );
    }
}
