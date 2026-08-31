package com.moov.pim.integration.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Id;
import jakarta.persistence.PreUpdate;
import jakarta.persistence.Table;

import java.time.LocalDateTime;
import java.util.UUID;

/**
 * Adresse reelle d'un systeme destinataire.
 *
 * Tant qu'aucune URL n'est renseignee pour un systeme, la plateforme ne pretend
 * pas l'appeler : la fiche reste disponible en lecture sur /feed et l'export
 * porte l'etat « en attente de consommation ». Renseigner l'URL suffit a faire
 * basculer ce systeme en remise active, sans redeploiement.
 */
@Entity
@Table(name = "integration_endpoints")
public class IntegrationEndpoint {

    @Id
    @Enumerated(EnumType.STRING)
    @Column(name = "target_system", nullable = false)
    private TargetSystem targetSystem;

    private String url;

    /** En-tete d'authentification exige par le systeme tiers, restitue tel quel. */
    @Column(name = "auth_header")
    private String authHeader;

    @Column(nullable = false)
    private boolean active = false;

    @Column(name = "updated_by_id")
    private UUID updatedById;

    @Column(name = "updated_at", nullable = false)
    private LocalDateTime updatedAt = LocalDateTime.now();

    public IntegrationEndpoint() {}

    @PreUpdate
    void onUpdate() {
        updatedAt = LocalDateTime.now();
    }

    /** Vrai lorsque la remise HTTP est reellement possible. */
    public boolean isReachable() {
        return active && url != null && !url.isBlank();
    }

    public TargetSystem getTargetSystem() { return targetSystem; }
    public void setTargetSystem(TargetSystem targetSystem) { this.targetSystem = targetSystem; }
    public String getUrl() { return url; }
    public void setUrl(String url) { this.url = url; }
    public String getAuthHeader() { return authHeader; }
    public void setAuthHeader(String authHeader) { this.authHeader = authHeader; }
    public boolean isActive() { return active; }
    public void setActive(boolean active) { this.active = active; }
    public UUID getUpdatedById() { return updatedById; }
    public void setUpdatedById(UUID updatedById) { this.updatedById = updatedById; }
    public LocalDateTime getUpdatedAt() { return updatedAt; }
}
