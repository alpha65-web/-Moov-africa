package com.moov.pim.shared.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.PreUpdate;
import jakarta.persistence.Table;

import java.time.LocalDateTime;
import java.util.UUID;

/**
 * Reglages generaux de la plateforme. Table a ligne unique (id = 1).
 */
@Entity
@Table(name = "platform_settings")
public class PlatformSettings {

    /** Identifiant fixe : la table ne contient qu'une ligne. */
    public static final int SINGLETON_ID = 1;

    @Id
    private Integer id = SINGLETON_ID;

    @Column(name = "platform_name", nullable = false, length = 120)
    private String platformName = "Moov Africa PIM";

    @Column(name = "default_language", nullable = false, length = 10)
    private String defaultLanguage = "fr";

    @Column(nullable = false, length = 10)
    private String currency = "XOF";

    @Column(nullable = false, length = 60)
    private String timezone = "Africa/Ouagadougou";

    @Column(name = "updated_by_id")
    private UUID updatedById;

    @Column(name = "updated_at", nullable = false)
    private LocalDateTime updatedAt = LocalDateTime.now();

    protected PlatformSettings() {}

    @PreUpdate
    void onUpdate() {
        updatedAt = LocalDateTime.now();
    }

    public Integer getId() { return id; }
    public String getPlatformName() { return platformName; }
    public void setPlatformName(String platformName) { this.platformName = platformName; }
    public String getDefaultLanguage() { return defaultLanguage; }
    public void setDefaultLanguage(String defaultLanguage) { this.defaultLanguage = defaultLanguage; }
    public String getCurrency() { return currency; }
    public void setCurrency(String currency) { this.currency = currency; }
    public String getTimezone() { return timezone; }
    public void setTimezone(String timezone) { this.timezone = timezone; }
    public UUID getUpdatedById() { return updatedById; }
    public void setUpdatedById(UUID updatedById) { this.updatedById = updatedById; }
    public LocalDateTime getUpdatedAt() { return updatedAt; }
}
