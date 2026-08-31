package com.moov.pim.integration.api.dto;

import com.moov.pim.integration.domain.IntegrationApiKey;

import java.time.LocalDateTime;
import java.util.UUID;

/**
 * Etat d'une cle de consommation, sans jamais en revealer la valeur.
 *
 * {@code lastUsedAt} et {@code callCount} sont la pour que l'administrateur
 * constate qu'un systeme destinataire consomme reellement le flux : une cle
 * creee mais jamais utilisee signale un raccordement qui n'a pas abouti.
 */
public record IntegrationApiKeyResponse(
        UUID id,
        String label,
        String targetSystem,
        String keyPrefix,
        boolean active,
        LocalDateTime createdAt,
        LocalDateTime lastUsedAt,
        long callCount,
        LocalDateTime revokedAt
) {
    public static IntegrationApiKeyResponse from(IntegrationApiKey k) {
        return new IntegrationApiKeyResponse(
                k.getId(), k.getLabel(), k.getTargetSystem().name(), k.getKeyPrefix(),
                k.isActive(), k.getCreatedAt(), k.getLastUsedAt(), k.getCallCount(), k.getRevokedAt());
    }
}
