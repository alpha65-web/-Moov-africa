package com.moov.pim.integration.api.dto;

import com.moov.pim.integration.domain.IntegrationExport;

import java.time.LocalDateTime;
import java.util.UUID;

/**
 * Etat d'une diffusion, tel que l'ecran Exports doit pouvoir le justifier.
 *
 * Les champs de tracabilite ne sont pas decoratifs : ils sont ce qui distingue un
 * statut constate d'un statut affirme. Un SUCCESS sans {@code httpStatus} ni
 * {@code consumedAt} n'aurait aucune preuve derriere lui — c'etait precisement le
 * defaut de la version precedente, qui marquait toutes les diffusions reussies
 * sans jamais appeler ni servir personne.
 *
 * @param deliveryMode PUSH si la plateforme a appele le systeme destinataire,
 *                     PULL si la fiche a ete mise a disposition sur le flux.
 * @param httpStatus   code renvoye par le destinataire en mode PUSH.
 * @param consumedAt   premiere lecture effective de la fiche en mode PULL.
 */
public record IntegrationExportResponse(
        UUID id,
        String targetSystem,
        UUID offerId,
        String exportType,
        String status,
        String deliveryMode,
        String endpointUrl,
        Integer httpStatus,
        LocalDateTime consumedAt,
        int consumedCount,
        String errorMessage,
        int retryCount,
        LocalDateTime createdAt,
        LocalDateTime completedAt
) {
    public static IntegrationExportResponse from(IntegrationExport e) {
        return new IntegrationExportResponse(
                e.getId(), e.getTargetSystem().name(), e.getOfferId(),
                e.getExportType().name(), e.getStatus().name(),
                e.getDeliveryMode() == null ? null : e.getDeliveryMode().name(),
                e.getEndpointUrl(), e.getHttpStatus(),
                e.getConsumedAt(), e.getConsumedCount(),
                e.getErrorMessage(),
                e.getRetryCount(), e.getCreatedAt(), e.getCompletedAt()
        );
    }
}
