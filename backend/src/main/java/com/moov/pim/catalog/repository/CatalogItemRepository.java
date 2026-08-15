package com.moov.pim.catalog.repository;

import com.moov.pim.catalog.domain.CatalogItem;
import com.moov.pim.catalog.domain.CatalogItemStatus;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;

import java.util.List;
import java.util.UUID;

public interface CatalogItemRepository extends JpaRepository<CatalogItem, UUID>, JpaSpecificationExecutor<CatalogItem> {

    List<CatalogItem> findByStatus(CatalogItemStatus status);

    List<CatalogItem> findByCategoryId(UUID categoryId);

    boolean existsByNameAndCategoryId(String name, UUID categoryId);

    Page<CatalogItem> findByStatus(CatalogItemStatus status, Pageable pageable);
}
