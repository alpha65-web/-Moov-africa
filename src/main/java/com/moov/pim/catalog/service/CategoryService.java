package com.moov.pim.catalog.service;

import com.moov.pim.catalog.api.dto.CategoryRequest;
import com.moov.pim.catalog.api.dto.CategoryResponse;
import com.moov.pim.catalog.domain.Category;
import com.moov.pim.catalog.repository.CatalogItemRepository;
import com.moov.pim.catalog.repository.CategoryRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.UUID;

@Service
public class CategoryService {

    private final CategoryRepository categoryRepository;
    private final CatalogItemRepository catalogItemRepository;

    public CategoryService(CategoryRepository categoryRepository, CatalogItemRepository catalogItemRepository) {
        this.categoryRepository = categoryRepository;
        this.catalogItemRepository = catalogItemRepository;
    }

    @Transactional
    public CategoryResponse create(CategoryRequest request) {
        Category parent = null;
        int level = 0;

        if (request.parentId() != null) {
            parent = categoryRepository.findById(request.parentId())
                    .orElseThrow(() -> new IllegalArgumentException("Catégorie parente introuvable"));
            level = parent.getLevel() + 1;
        }

        if (categoryRepository.existsByNameAndLevel(request.name(), level)) {
            throw new IllegalArgumentException("Une catégorie avec ce nom existe déjà à ce niveau");
        }

        Category category = new Category(request.name(), request.description(), parent, level);
        category = categoryRepository.save(category);
        return CategoryResponse.from(category);
    }

    @Transactional(readOnly = true)
    public List<CategoryResponse> listRoots() {
        return categoryRepository.findByParentIsNullOrderByNameAsc().stream()
                .map(CategoryResponse::from)
                .toList();
    }

    @Transactional(readOnly = true)
    public List<CategoryResponse> listChildren(UUID parentId) {
        return categoryRepository.findByParentIdOrderByNameAsc(parentId).stream()
                .map(CategoryResponse::from)
                .toList();
    }

    @Transactional
    public void delete(UUID id) {
        if (!categoryRepository.findByParentIdOrderByNameAsc(id).isEmpty()) {
            throw new IllegalStateException("Impossible de supprimer : cette catégorie a des sous-catégories");
        }
        if (!catalogItemRepository.findByCategoryId(id).isEmpty()) {
            throw new IllegalStateException("Impossible de supprimer : des éléments sont rattachés à cette catégorie");
        }
        categoryRepository.deleteById(id);
    }
}
