package com.moov.pim.permissions.repository;

import com.moov.pim.permissions.domain.PasswordResetRequest;
import com.moov.pim.permissions.domain.PasswordResetRequestStatus;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface PasswordResetRequestRepository extends JpaRepository<PasswordResetRequest, UUID> {

    Optional<PasswordResetRequest> findByUserIdAndStatus(UUID userId, PasswordResetRequestStatus status);

    List<PasswordResetRequest> findByStatusOrderByRequestedAtDesc(PasswordResetRequestStatus status);

    long countByStatus(PasswordResetRequestStatus status);

    /**
     * Demandes en attente pour une liste de comptes.
     *
     * Sert a pastiller la liste des utilisateurs sans une requete par ligne.
     */
    List<PasswordResetRequest> findByStatusAndUserIdIn(PasswordResetRequestStatus status, List<UUID> userIds);
}
