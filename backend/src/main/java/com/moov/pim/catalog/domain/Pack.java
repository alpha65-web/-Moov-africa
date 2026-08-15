package com.moov.pim.catalog.domain;

import jakarta.persistence.CascadeType;
import jakarta.persistence.Column;
import jakarta.persistence.DiscriminatorValue;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.OneToMany;
import jakarta.persistence.Table;

import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.List;

@Entity
@Table(name = "packs")
@DiscriminatorValue("PACK")
public class Pack extends CatalogItem {

    @Column(name = "bundle_price", precision = 15, scale = 2)
    private BigDecimal bundlePrice;

    @Column(name = "bundle_discount", precision = 5, scale = 2)
    private BigDecimal bundleDiscount;

    @OneToMany(mappedBy = "pack", cascade = CascadeType.ALL, orphanRemoval = true, fetch = FetchType.LAZY)
    private List<PackItem> items = new ArrayList<>();

    public Pack() {}

    public BigDecimal getBundlePrice() { return bundlePrice; }
    public void setBundlePrice(BigDecimal bundlePrice) { this.bundlePrice = bundlePrice; }
    public BigDecimal getBundleDiscount() { return bundleDiscount; }
    public void setBundleDiscount(BigDecimal bundleDiscount) { this.bundleDiscount = bundleDiscount; }
    public List<PackItem> getItems() { return items; }

    public void addItem(PackItem item) {
        items.add(item);
        item.setPack(this);
    }
}
