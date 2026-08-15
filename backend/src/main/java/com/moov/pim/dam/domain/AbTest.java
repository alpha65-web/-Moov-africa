package com.moov.pim.dam.domain;

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
@Table(name = "ab_tests")
public class AbTest {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(name = "offer_id", nullable = false)
    private UUID offerId;

    @Column(name = "variant_a", nullable = false)
    private String variantA;

    @Column(name = "variant_b", nullable = false)
    private String variantB;

    @Column(nullable = false)
    private String metric;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private AbTestStatus status = AbTestStatus.DRAFT;

    private String winner;

    @Column(name = "created_by_id", nullable = false)
    private UUID createdById;

    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    public AbTest() {}

    @PrePersist
    void onCreate() {
        createdAt = LocalDateTime.now();
    }

    public UUID getId() { return id; }
    public UUID getOfferId() { return offerId; }
    public void setOfferId(UUID offerId) { this.offerId = offerId; }
    public String getVariantA() { return variantA; }
    public void setVariantA(String variantA) { this.variantA = variantA; }
    public String getVariantB() { return variantB; }
    public void setVariantB(String variantB) { this.variantB = variantB; }
    public String getMetric() { return metric; }
    public void setMetric(String metric) { this.metric = metric; }
    public AbTestStatus getStatus() { return status; }
    public void setStatus(AbTestStatus status) { this.status = status; }
    public String getWinner() { return winner; }
    public void setWinner(String winner) { this.winner = winner; }
    public UUID getCreatedById() { return createdById; }
    public void setCreatedById(UUID createdById) { this.createdById = createdById; }
    public LocalDateTime getCreatedAt() { return createdAt; }
}
