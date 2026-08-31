package com.moov.pim.integration.domain;

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
 * Cle remise a un systeme tiers pour interroger le flux des offres publiees.
 *
 * Un systeme externe n'a pas de compte sur la plateforme : lui demander un jeton
 * d'utilisateur reviendrait a lui confier les identifiants d'une personne. La cle
 * est portee par le systeme destinataire, ce qui permet aussi de savoir ce que
 * chaque canal a reellement lu, et quand.
 *
 * Seule l'empreinte SHA-256 est conservee. Le prefixe, lui, est stocke en clair :
 * il sert a reconnaitre une cle dans la liste sans jamais la revealer.
 */
@Entity
@Table(name = "integration_api_keys")
public class IntegrationApiKey {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(nullable = false)
    private String label;

    @Enumerated(EnumType.STRING)
    @Column(name = "target_system", nullable = false)
    private TargetSystem targetSystem;

    @Column(name = "key_hash", nullable = false, unique = true)
    private String keyHash;

    @Column(name = "key_prefix", nullable = false)
    private String keyPrefix;

    @Column(nullable = false)
    private boolean active = true;

    @Column(name = "created_by_id")
    private UUID createdById;

    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @Column(name = "last_used_at")
    private LocalDateTime lastUsedAt;

    @Column(name = "call_count", nullable = false)
    private long callCount = 0;

    @Column(name = "revoked_at")
    private LocalDateTime revokedAt;

    public IntegrationApiKey() {}

    @PrePersist
    void onCreate() {
        createdAt = LocalDateTime.now();
    }

    public UUID getId() { return id; }
    public String getLabel() { return label; }
    public void setLabel(String label) { this.label = label; }
    public TargetSystem getTargetSystem() { return targetSystem; }
    public void setTargetSystem(TargetSystem targetSystem) { this.targetSystem = targetSystem; }
    public String getKeyHash() { return keyHash; }
    public void setKeyHash(String keyHash) { this.keyHash = keyHash; }
    public String getKeyPrefix() { return keyPrefix; }
    public void setKeyPrefix(String keyPrefix) { this.keyPrefix = keyPrefix; }
    public boolean isActive() { return active; }
    public void setActive(boolean active) { this.active = active; }
    public UUID getCreatedById() { return createdById; }
    public void setCreatedById(UUID createdById) { this.createdById = createdById; }
    public LocalDateTime getCreatedAt() { return createdAt; }
    public LocalDateTime getLastUsedAt() { return lastUsedAt; }
    public void setLastUsedAt(LocalDateTime lastUsedAt) { this.lastUsedAt = lastUsedAt; }
    public long getCallCount() { return callCount; }
    public void setCallCount(long callCount) { this.callCount = callCount; }
    public LocalDateTime getRevokedAt() { return revokedAt; }
    public void setRevokedAt(LocalDateTime revokedAt) { this.revokedAt = revokedAt; }
}
