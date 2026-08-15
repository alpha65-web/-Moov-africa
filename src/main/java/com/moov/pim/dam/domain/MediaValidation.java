package com.moov.pim.dam.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.PrePersist;
import jakarta.persistence.Table;

import java.time.LocalDateTime;
import java.util.UUID;

@Entity
@Table(name = "media_validations")
public class MediaValidation {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "media_asset_id", nullable = false)
    private MediaAsset mediaAsset;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private ValidationStatus status = ValidationStatus.PENDING;

    private String annotation;

    @Enumerated(EnumType.STRING)
    @Column(name = "media_type", nullable = false)
    private AssetMediaType mediaType;

    @Column(name = "validated_by_id")
    private UUID validatedById;

    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    protected MediaValidation() {}

    @PrePersist
    void onCreate() {
        createdAt = LocalDateTime.now();
    }

    public UUID getId() { return id; }
    public MediaAsset getMediaAsset() { return mediaAsset; }
    public void setMediaAsset(MediaAsset mediaAsset) { this.mediaAsset = mediaAsset; }
    public ValidationStatus getStatus() { return status; }
    public void setStatus(ValidationStatus status) { this.status = status; }
    public String getAnnotation() { return annotation; }
    public void setAnnotation(String annotation) { this.annotation = annotation; }
    public AssetMediaType getMediaType() { return mediaType; }
    public void setMediaType(AssetMediaType mediaType) { this.mediaType = mediaType; }
    public UUID getValidatedById() { return validatedById; }
    public void setValidatedById(UUID validatedById) { this.validatedById = validatedById; }
    public LocalDateTime getCreatedAt() { return createdAt; }
}
