package com.moov.pim.catalog.repository;

import com.moov.pim.catalog.domain.Category;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.UUID;

public interface CategoryRepository extends JpaRepository<Category, UUID> {

    List<Category> findByParentIsNullOrderByNameAsc();

    List<Category> findByParentIdOrderByNameAsc(UUID parentId);

    boolean existsByNameAndLevel(String name, int level);
}
