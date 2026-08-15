package com.moov.pim.lifecycle.domain;

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
@Table(name = "offer_items")
public class OfferItem {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "offer_id", nullable = false)
    private Offer offer;

    @Column(name = "catalog_item_id", nullable = false)
    private UUID catalogItemId;

    protected OfferItem() {}

    public OfferItem(UUID catalogItemId) {
        this.catalogItemId = catalogItemId;
    }

    public UUID getId() { return id; }
    public Offer getOffer() { return offer; }
    void setOffer(Offer offer) { this.offer = offer; }
    public UUID getCatalogItemId() { return catalogItemId; }
}
