package com.moov.pim.dam.domain;

import jakarta.persistence.CascadeType;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.OneToMany;
import jakarta.persistence.PrePersist;
import jakarta.persistence.Table;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

@Entity
@Table(name = "media_assets")
public class MediaAsset {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(name = "file_name", nullable = false)
    private String fileName;

    @Column(name = "mime_type", nullable = false)
    private String mimeType;

    @Column(name = "file_size", nullable = false)
    private long fileSize;

    @Column(name = "storage_key", nullable = false)
    private String storageKey;

    private int width;
    private int height;
    private int resolution;

    @Enumerated(EnumType.STRING)
    @Column(name = "conformity_status", nullable = false)
    private ConformityStatus conformityStatus = ConformityStatus.PENDING;

    @Column(name = "copyright_risk", nullable = false)
    private boolean copyrightRisk = false;

    @Column(name = "parent_media_id")
    private UUID parentMediaId;

    @Column(name = "media_version", nullable = false)
    private int mediaVersion = 1;

    @Column(name = "uploaded_by_id", nullable = false)
    private UUID uploadedById;

    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @OneToMany(mappedBy = "mediaAsset", cascade = CascadeType.ALL, orphanRemoval = true, fetch = FetchType.LAZY)
    private List<MediaValidation> validations = new ArrayList<>();

    protected MediaAsset() {}

    @PrePersist
    void onCreate() {
        createdAt = LocalDateTime.now();
    }

    public UUID getId() { return id; }
    public String getFileName() { return fileName; }
    public void setFileName(String fileName) { this.fileName = fileName; }
    public String getMimeType() { return mimeType; }
    public void setMimeType(String mimeType) { this.mimeType = mimeType; }
    public long getFileSize() { return fileSize; }
    public void setFileSize(long fileSize) { this.fileSize = fileSize; }
    public String getStorageKey() { return storageKey; }
    public void setStorageKey(String storageKey) { this.storageKey = storageKey; }
    public int getWidth() { return width; }
    public void setWidth(int width) { this.width = width; }
    public int getHeight() { return height; }
    public void setHeight(int height) { this.height = height; }
    public int getResolution() { return resolution; }
    public void setResolution(int resolution) { this.resolution = resolution; }
    public ConformityStatus getConformityStatus() { return conformityStatus; }
    public void setConformityStatus(ConformityStatus conformityStatus) { this.conformityStatus = conformityStatus; }
    public boolean isCopyrightRisk() { return copyrightRisk; }
    public void setCopyrightRisk(boolean copyrightRisk) { this.copyrightRisk = copyrightRisk; }
    public UUID getParentMediaId() { return parentMediaId; }
    public int getMediaVersion() { return mediaVersion; }
    public void setMediaVersion(int mediaVersion) { this.mediaVersion = mediaVersion; }
    public UUID getUploadedById() { return uploadedById; }
    public void setUploadedById(UUID uploadedById) { this.uploadedById = uploadedById; }
    public LocalDateTime getCreatedAt() { return createdAt; }
    public List<MediaValidation> getValidations() { return validations; }
}
