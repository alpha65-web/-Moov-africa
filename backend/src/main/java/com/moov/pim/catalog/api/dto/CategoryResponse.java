package com.moov.pim.catalog.api.dto;

import com.moov.pim.catalog.domain.Category;

import java.time.LocalDateTime;
import java.util.UUID;

/**
 * Categorie telle qu'exposee par l'API.
 *
 * {@code type} porte le premier niveau de classification, {@code typeLabel} son
 * libelle francais afin que l'interface n'ait pas a maintenir sa propre table de
 * correspondance — c'est ce doublon qui avait laisse coexister une liste de
 * categories en dur cote frontend et l'arborescence reelle en base.
 */
public record CategoryResponse(
        UUID id,
        String name,
        String description,
        String type,
        String typeLabel,
        UUID parentId,
        String parentName,
        int level,
        boolean active,
        LocalDateTime createdAt
) {
    public static CategoryResponse from(Category category) {
        Category parent = category.getParent();
        return new CategoryResponse(
                category.getId(),
                category.getName(),
                category.getDescription(),
                category.getType().name(),
                category.getType().getLabel(),
                parent != null ? parent.getId() : null,
                parent != null ? parent.getName() : null,
                category.getLevel(),
                category.isActive(),
                category.getCreatedAt()
        );
    }
}
