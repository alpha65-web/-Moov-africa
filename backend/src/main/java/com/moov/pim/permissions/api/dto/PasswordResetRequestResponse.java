package com.moov.pim.permissions.api.dto;

import com.moov.pim.permissions.domain.PasswordResetRequest;
import com.moov.pim.permissions.domain.User;

import java.time.LocalDateTime;
import java.util.UUID;

/**
 * Une ligne de la file des demandes, telle que l'administrateur la voit.
 *
 * L'identite du compte est jointe pour que l'ecran affiche la personne sans un
 * appel supplementaire, et que l'administrateur reconnaisse le demandeur avant
 * de lui poser un mot de passe provisoire.
 */
public record PasswordResetRequestResponse(
        UUID id,
        UUID userId,
        String email,
        String firstName,
        String lastName,
        String role,
        String status,
        String requesterIp,
        LocalDateTime requestedAt,
        LocalDateTime handledAt
) {
    public static PasswordResetRequestResponse from(PasswordResetRequest request, User user) {
        return new PasswordResetRequestResponse(
                request.getId(),
                request.getUserId(),
                user.getEmail(),
                user.getFirstName(),
                user.getLastName(),
                user.getRole().getName().name(),
                request.getStatus().name(),
                request.getRequesterIp(),
                request.getRequestedAt(),
                request.getHandledAt()
        );
    }
}
