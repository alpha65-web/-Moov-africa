package com.moov.pim.rules.domain;

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

@Entity
@Table(name = "business_rules")
public class BusinessRule {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(nullable = false)
    private String name;

    @Enumerated(EnumType.STRING)
    @Column(name = "rule_type", nullable = false)
    private RuleType ruleType;

    private String description;

    @Column(nullable = false)
    private boolean active = true;

    /**
     * La violation de cette regle empeche-t-elle l'enregistrement ?
     *
     * Le cahier des charges (7.3) prevoit que le systeme « bloque ou avertit » :
     * les deux comportements existent, il fallait pouvoir choisir. Une regle non
     * bloquante permet d'introduire progressivement une contrainte sur un
     * catalogue deja constitue, sans rendre insoumissibles les offres existantes
     * qui la violent.
     */
    @Column(nullable = false)
    private boolean blocking = true;

    @Column(name = "source_item_id", nullable = false)
    private UUID sourceItemId;

    @Column(name = "target_item_id", nullable = false)
    private UUID targetItemId;

    @Column(name = "created_by_id", nullable = false)
    private UUID createdById;

    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    public BusinessRule() {}

    @PrePersist
    void onCreate() {
        createdAt = LocalDateTime.now();
    }

    public boolean isBlocking() { return blocking; }
    public void setBlocking(boolean blocking) { this.blocking = blocking; }

    public UUID getId() { return id; }
    public String getName() { return name; }
    public void setName(String name) { this.name = name; }
    public RuleType getRuleType() { return ruleType; }
    public void setRuleType(RuleType ruleType) { this.ruleType = ruleType; }
    public String getDescription() { return description; }
    public void setDescription(String description) { this.description = description; }
    public boolean isActive() { return active; }
    public void setActive(boolean active) { this.active = active; }
    public UUID getSourceItemId() { return sourceItemId; }
    public void setSourceItemId(UUID sourceItemId) { this.sourceItemId = sourceItemId; }
    public UUID getTargetItemId() { return targetItemId; }
    public void setTargetItemId(UUID targetItemId) { this.targetItemId = targetItemId; }
    public UUID getCreatedById() { return createdById; }
    public void setCreatedById(UUID createdById) { this.createdById = createdById; }
    public LocalDateTime getCreatedAt() { return createdAt; }
}
