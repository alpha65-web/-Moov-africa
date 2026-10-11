package com.moov.pim.permissions.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.PrePersist;
import jakarta.persistence.Table;

import java.time.LocalDateTime;
import java.util.UUID;

/**
 * Demande de reinitialisation adressee a l'administrateur par une personne qui
 * ne peut plus se connecter.
 *
 * La demande ne porte aucun secret et n'ouvre aucun acces par elle-meme : elle
 * signale seulement qu'un compte attend un mot de passe provisoire. C'est
 * l'administrateur qui repose le mot de passe, par le chemin habituel, ce qui
 * evite d'introduire un second circuit d'authentification a securiser.
 */
@Entity
@Table(name = "password_reset_requests")
public class PasswordResetRequest {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(name = "user_id", nullable = false)
    private UUID userId;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private PasswordResetRequestStatus status = PasswordResetRequestStatus.PENDING;

    @Column(name = "requested_at", nullable = false, updatable = false)
    private LocalDateTime requestedAt;

    @Column(name = "handled_at")
    private LocalDateTime handledAt;

    @Column(name = "handled_by")
    private UUID handledBy;

    @Column(name = "requester_ip", length = 45)
    private String requesterIp;

    protected PasswordResetRequest() {}

    public PasswordResetRequest(UUID userId, String requesterIp) {
        this.userId = userId;
        this.requesterIp = requesterIp;
    }

    @PrePersist
    void onCreate() {
        requestedAt = LocalDateTime.now();
    }

    /** Cloture la demande, que l'administrateur l'ait traitee ou ecartee. */
    public void close(PasswordResetRequestStatus outcome, UUID administratorId) {
        this.status = outcome;
        this.handledAt = LocalDateTime.now();
        this.handledBy = administratorId;
    }

    public UUID getId() { return id; }
    public UUID getUserId() { return userId; }
    public PasswordResetRequestStatus getStatus() { return status; }
    public LocalDateTime getRequestedAt() { return requestedAt; }
    public LocalDateTime getHandledAt() { return handledAt; }
    public UUID getHandledBy() { return handledBy; }
    public String getRequesterIp() { return requesterIp; }
}
