package com.moov.pim.catalog.repository;

import com.moov.pim.catalog.domain.Category;
import com.moov.pim.catalog.domain.ItemType;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.UUID;

public interface CategoryRepository extends JpaRepository<Category, UUID> {

    List<Category> findByParentIsNullOrderByNameAsc();

    List<Category> findByParentIdOrderByNameAsc(UUID parentId);

    /** Categories racines d'un type, tous etats confondus (ecran d'administration). */
    List<Category> findByTypeAndParentIsNullOrderByNameAsc(ItemType type);

    /** Categories racines selectionnables d'un type (formulaires). */
    List<Category> findByTypeAndParentIsNullAndActiveTrueOrderByNameAsc(ItemType type);

    List<Category> findByParentIdAndActiveTrueOrderByNameAsc(UUID parentId);

    List<Category> findByTypeOrderByNameAsc(ItemType type);

    /**
     * Un libelle ne doit pas se repeter au sein d'une meme fratrie. L'unicite porte
     * sur (type, parent, name) et non plus sur (name, level) : « Forfaits Data » a
     * un sens sous OFFRE comme sous SERVICE, mais pas deux fois sous le meme parent.
     */
    boolean existsByTypeAndParentIsNullAndNameIgnoreCase(ItemType type, String name);

    boolean existsByTypeAndParentIdAndNameIgnoreCase(ItemType type, UUID parentId, String name);
}
