package com.moov.pim.dam.api.dto;

import com.moov.pim.dam.domain.MediaValidation;

import java.time.LocalDateTime;
import java.util.UUID;

/**
 * Une decision prise sur un visuel, dans le circuit de validation graphique.
 *
 * Les decisions etaient ecrites en base et jamais relues : aucune route ne les
 * exposait. Le chef de service ne revoyait pas ses propres avis, et l'analyste
 * marketing, a qui le cahier des charges (7.6) demande de « corriger et
 * redeposer » apres un rejet, n'avait aucun moyen de savoir ce qui lui etait
 * reproche.
 */
public record MediaValidationResponse(
        UUID id,
        UUID mediaAssetId,
        String status,
        String annotation,
        String mediaType,
        UUID validatedById,
        LocalDateTime createdAt
) {
    public static MediaValidationResponse from(MediaValidation v) {
        return new MediaValidationResponse(
                v.getId(),
                v.getMediaAsset() == null ? null : v.getMediaAsset().getId(),
                v.getStatus().name(),
                v.getAnnotation(),
                v.getMediaType().name(),
                v.getValidatedById(),
                v.getCreatedAt());
    }
}
