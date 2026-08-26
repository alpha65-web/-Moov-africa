package com.moov.pim.catalog.domain;

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

/**
 * Noeud de l'arborescence de classification.
 *
 * Une categorie appartient a un {@link ItemType} et un seul. Une sous-categorie
 * herite obligatoirement du type de sa categorie parente : c'est ce qui garantit
 * qu'une branche entiere reste homogene et qu'aucun chemin
 * TYPE -> CATEGORIE -> SOUS-CATEGORIE ne melange deux natures d'element.
 *
 * L'unicite ne porte plus sur (name, level) mais sur (type, parent, name) — voir
 * la migration V044. L'ancienne contrainte interdisait qu'une meme feuille existe
 * sous deux types differents, alors que « Forfaits Data » a legitimement un sens
 * cote OFFRE comme cote SERVICE selon la branche.
 *
 * La mise hors service est logique ({@link #active}) et non physique : des
 * elements deja classes continuent de referencer la categorie, et une suppression
 * les laisserait orphelins. Une categorie inactive reste consultable mais n'est
 * plus proposee a la selection.
 */
@Entity
@Table(name = "categories")
public class Category {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(nullable = false)
    private String name;

    private String description;

    /**
     * Premier niveau de classification. Immuable apres creation : le changer
     * invaliderait d'un coup toutes les sous-categories et tous les elements deja
     * ranges dans cette branche.
     */
    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20, updatable = false)
    private ItemType type;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "parent_id")
    private Category parent;

    @Column(nullable = false)
    private int level;

    @Column(nullable = false)
    private boolean active = true;

    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    protected Category() {}

    public Category(String name, String description, Category parent, int level, ItemType type) {
        this.name = name;
        this.description = description;
        this.parent = parent;
        this.level = level;
        this.type = type;
    }

    @PrePersist
    void onCreate() {
        createdAt = LocalDateTime.now();
    }

    public UUID getId() { return id; }
    public String getName() { return name; }
    public void setName(String name) { this.name = name; }
    public String getDescription() { return description; }
    public void setDescription(String description) { this.description = description; }
    public ItemType getType() { return type; }
    public Category getParent() { return parent; }
    public int getLevel() { return level; }
    public boolean isActive() { return active; }
    public void setActive(boolean active) { this.active = active; }
    public LocalDateTime getCreatedAt() { return createdAt; }
}
