package com.moov.pim.analytics.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.PreUpdate;
import jakarta.persistence.Table;

import java.time.LocalDateTime;
import java.util.UUID;

@Entity
@Table(name = "kpi_configs")
public class KpiConfig {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(name = "kpi_code", nullable = false, unique = true, length = 60)
    private String kpiCode;

    @Column(nullable = false)
    private String label;

    @Column(nullable = false)
    private boolean enabled = true;

    @Column(name = "threshold_expression")
    private String thresholdExpression;

    @Column(name = "updated_by_id")
    private UUID updatedById;

    @Column(name = "updated_at", nullable = false)
    private LocalDateTime updatedAt = LocalDateTime.now();

    protected KpiConfig() {}

    @PreUpdate
    void onUpdate() {
        updatedAt = LocalDateTime.now();
    }

    public UUID getId() { return id; }
    public String getKpiCode() { return kpiCode; }
    public String getLabel() { return label; }
    public void setLabel(String label) { this.label = label; }
    public boolean isEnabled() { return enabled; }
    public void setEnabled(boolean enabled) { this.enabled = enabled; }
    public String getThresholdExpression() { return thresholdExpression; }
    public void setThresholdExpression(String thresholdExpression) { this.thresholdExpression = thresholdExpression; }
    public UUID getUpdatedById() { return updatedById; }
    public void setUpdatedById(UUID updatedById) { this.updatedById = updatedById; }
    public LocalDateTime getUpdatedAt() { return updatedAt; }
}
