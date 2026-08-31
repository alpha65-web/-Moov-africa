package com.moov.pim.integration.api.dto;

import com.moov.pim.integration.domain.IntegrationEndpoint;

import java.time.LocalDateTime;
import java.util.UUID;

/**
 * Raccordement d'un systeme destinataire.
 *
 * {@code reachable} dit si la plateforme peut reellement appeler ce systeme. Tant
 * qu'il vaut faux, les fiches ne sont pas poussees : elles restent lisibles sur le
 * flux et l'ecran doit l'annoncer comme tel plutot que d'afficher une diffusion.
 */
public record IntegrationEndpointResponse(
        String targetSystem,
        String url,
        boolean active,
        boolean reachable,
        UUID updatedById,
        LocalDateTime updatedAt
) {
    public static IntegrationEndpointResponse from(IntegrationEndpoint e) {
        return new IntegrationEndpointResponse(
                e.getTargetSystem().name(), e.getUrl(), e.isActive(), e.isReachable(),
                e.getUpdatedById(), e.getUpdatedAt());
    }
}
