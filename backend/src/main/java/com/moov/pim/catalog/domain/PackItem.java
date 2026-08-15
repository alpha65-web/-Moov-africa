package com.moov.pim.catalog.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;

import java.util.UUID;

@Entity
@Table(name = "pack_items")
public class PackItem {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "pack_id", nullable = false)
    private Pack pack;

    @Column(name = "catalog_item_id", nullable = false)
    private UUID catalogItemId;

    @Column(nullable = false)
    private int quantity = 1;

    protected PackItem() {}

    public PackItem(UUID catalogItemId, int quantity) {
        this.catalogItemId = catalogItemId;
        this.quantity = quantity;
    }

    public UUID getId() { return id; }
    public Pack getPack() { return pack; }
    void setPack(Pack pack) { this.pack = pack; }
    public UUID getCatalogItemId() { return catalogItemId; }
    public int getQuantity() { return quantity; }
}
