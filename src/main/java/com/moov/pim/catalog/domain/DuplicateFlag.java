package com.moov.pim.catalog.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.PrePersist;
import jakarta.persistence.Table;

import java.time.LocalDateTime;
import java.util.UUID;

@Entity
@Table(name = "duplicate_flags")
public class DuplicateFlag {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(name = "source_product_id", nullable = false)
    private UUID sourceProductId;

    @Column(name = "duplicate_product_id", nullable = false)
    private UUID duplicateProductId;

    @Column(name = "similarity_score", nullable = false)
    private float similarityScore;

    @Column(nullable = false)
    private boolean resolved = false;

    @Column(name = "resolved_by_id")
    private UUID resolvedById;

    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    protected DuplicateFlag() {}

    public DuplicateFlag(UUID sourceProductId, UUID duplicateProductId, float similarityScore) {
        this.sourceProductId = sourceProductId;
        this.duplicateProductId = duplicateProductId;
        this.similarityScore = similarityScore;
    }

    @PrePersist
    void onCreate() {
        createdAt = LocalDateTime.now();
    }

    public UUID getId() { return id; }
    public UUID getSourceProductId() { return sourceProductId; }
    public UUID getDuplicateProductId() { return duplicateProductId; }
    public float getSimilarityScore() { return similarityScore; }
    public boolean isResolved() { return resolved; }
    public void setResolved(boolean resolved) { this.resolved = resolved; }
    public UUID getResolvedById() { return resolvedById; }
    public void setResolvedById(UUID resolvedById) { this.resolvedById = resolvedById; }
    public LocalDateTime getCreatedAt() { return createdAt; }
}
