package com.moov.pim.catalog.domain;

import jakarta.persistence.Column;
import jakarta.persistence.DiscriminatorValue;
import jakarta.persistence.Entity;
import jakarta.persistence.Table;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

@Entity
@Table(name = "products")
@DiscriminatorValue("PRODUCT")
public class Product extends CatalogItem {

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(columnDefinition = "jsonb")
    private String characteristics;

    @Column(name = "pack_only", nullable = false)
    private boolean packOnly = false;

    @Column(name = "quality_score", nullable = false)
    private float qualityScore = 0f;

    protected Product() {}

    public String getCharacteristics() { return characteristics; }
    public void setCharacteristics(String characteristics) { this.characteristics = characteristics; }
    public boolean isPackOnly() { return packOnly; }
    public void setPackOnly(boolean packOnly) { this.packOnly = packOnly; }
    public float getQualityScore() { return qualityScore; }
    public void setQualityScore(float qualityScore) { this.qualityScore = qualityScore; }
}
