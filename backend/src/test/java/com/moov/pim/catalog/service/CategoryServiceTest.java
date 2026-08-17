package com.moov.pim.catalog.service;

import com.moov.pim.catalog.api.dto.CategoryRequest;
import com.moov.pim.catalog.api.dto.CategoryResponse;
import com.moov.pim.catalog.domain.Category;
import com.moov.pim.catalog.domain.Product;
import com.moov.pim.catalog.repository.CatalogItemRepository;
import com.moov.pim.catalog.repository.CategoryRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.lang.reflect.Field;
import java.util.Collections;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class CategoryServiceTest {

    @Mock private CategoryRepository categoryRepository;
    @Mock private CatalogItemRepository catalogItemRepository;

    @InjectMocks private CategoryService categoryService;

    @Test
    void create_shouldCreateRootCategory() {
        CategoryRequest request = new CategoryRequest("Téléphonie", "Catégorie téléphonie", null);

        when(categoryRepository.existsByNameAndLevel("Téléphonie", 0)).thenReturn(false);
        when(categoryRepository.save(any(Category.class))).thenAnswer(inv -> {
            Category c = inv.getArgument(0);
            setId(c, UUID.randomUUID());
            return c;
        });

        CategoryResponse response = categoryService.create(request);

        assertNotNull(response);
        assertEquals("Téléphonie", response.name());
        assertEquals(0, response.level());
        assertNull(response.parentId());
    }

    @Test
    void create_shouldCreateChildCategoryWithParent() {
        UUID parentId = UUID.randomUUID();
        Category parent = new Category("Téléphonie", "Parent", null, 0);
        setId(parent, parentId);

        CategoryRequest request = new CategoryRequest("Mobiles", "Sous-catégorie", parentId);

        when(categoryRepository.findById(parentId)).thenReturn(Optional.of(parent));
        when(categoryRepository.existsByNameAndLevel("Mobiles", 1)).thenReturn(false);
        when(categoryRepository.save(any(Category.class))).thenAnswer(inv -> {
            Category c = inv.getArgument(0);
            setId(c, UUID.randomUUID());
            return c;
        });

        CategoryResponse response = categoryService.create(request);

        assertNotNull(response);
        assertEquals("Mobiles", response.name());
        assertEquals(1, response.level());
        assertEquals(parentId, response.parentId());
    }

    @Test
    void create_shouldThrowIfParentNotFound() {
        UUID fakeParentId = UUID.randomUUID();
        CategoryRequest request = new CategoryRequest("Orpheline", "Desc", fakeParentId);

        when(categoryRepository.findById(fakeParentId)).thenReturn(Optional.empty());

        IllegalArgumentException ex = assertThrows(IllegalArgumentException.class,
                () -> categoryService.create(request));
        assertTrue(ex.getMessage().contains("parente introuvable"));
    }

    @Test
    void create_shouldThrowIfDuplicateNameAtLevel() {
        CategoryRequest request = new CategoryRequest("Téléphonie", "Doublon", null);

        when(categoryRepository.existsByNameAndLevel("Téléphonie", 0)).thenReturn(true);

        IllegalArgumentException ex = assertThrows(IllegalArgumentException.class,
                () -> categoryService.create(request));
        assertTrue(ex.getMessage().contains("existe déjà"));
    }

    @Test
    void update_shouldUpdateCategory() {
        UUID categoryId = UUID.randomUUID();
        Category category = new Category("Ancien", "Old desc", null, 0);
        setId(category, categoryId);

        CategoryRequest request = new CategoryRequest("Nouveau", "New desc", null);

        when(categoryRepository.findById(categoryId)).thenReturn(Optional.of(category));
        when(categoryRepository.save(any(Category.class))).thenAnswer(inv -> inv.getArgument(0));

        CategoryResponse response = categoryService.update(categoryId, request);

        assertEquals("Nouveau", response.name());
        assertEquals("New desc", response.description());
    }

    @Test
    void update_shouldThrowIfNotFound() {
        UUID fakeId = UUID.randomUUID();
        CategoryRequest request = new CategoryRequest("X", "Y", null);

        when(categoryRepository.findById(fakeId)).thenReturn(Optional.empty());

        assertThrows(IllegalArgumentException.class, () -> categoryService.update(fakeId, request));
    }

    @Test
    void listRoots_shouldReturnRootCategories() {
        Category root = new Category("Racine", "Root", null, 0);
        setId(root, UUID.randomUUID());

        when(categoryRepository.findByParentIsNullOrderByNameAsc()).thenReturn(List.of(root));

        List<CategoryResponse> results = categoryService.listRoots();

        assertEquals(1, results.size());
        assertEquals("Racine", results.get(0).name());
    }

    @Test
    void listChildren_shouldReturnChildCategories() {
        UUID parentId = UUID.randomUUID();
        Category parent = new Category("Parent", "P", null, 0);
        setId(parent, parentId);
        Category child = new Category("Enfant", "E", parent, 1);
        setId(child, UUID.randomUUID());

        when(categoryRepository.findByParentIdOrderByNameAsc(parentId)).thenReturn(List.of(child));

        List<CategoryResponse> results = categoryService.listChildren(parentId);

        assertEquals(1, results.size());
        assertEquals("Enfant", results.get(0).name());
        assertEquals(parentId, results.get(0).parentId());
    }

    @Test
    void delete_shouldDeleteCategoryWithoutDependencies() {
        UUID categoryId = UUID.randomUUID();

        when(categoryRepository.findByParentIdOrderByNameAsc(categoryId)).thenReturn(Collections.emptyList());
        when(catalogItemRepository.findByCategoryId(categoryId)).thenReturn(Collections.emptyList());

        categoryService.delete(categoryId);

        verify(categoryRepository).deleteById(categoryId);
    }

    @Test
    void delete_shouldThrowIfHasChildren() {
        UUID categoryId = UUID.randomUUID();
        Category child = new Category("Enfant", "E", null, 1);
        setId(child, UUID.randomUUID());

        when(categoryRepository.findByParentIdOrderByNameAsc(categoryId)).thenReturn(List.of(child));

        IllegalStateException ex = assertThrows(IllegalStateException.class,
                () -> categoryService.delete(categoryId));
        assertTrue(ex.getMessage().contains("sous-catégories"));
    }

    @Test
    void delete_shouldThrowIfHasItems() {
        UUID categoryId = UUID.randomUUID();

        when(categoryRepository.findByParentIdOrderByNameAsc(categoryId)).thenReturn(Collections.emptyList());
        Product product = new Product();
        product.setName("Item");
        when(catalogItemRepository.findByCategoryId(categoryId)).thenReturn(List.of(product));

        IllegalStateException ex = assertThrows(IllegalStateException.class,
                () -> categoryService.delete(categoryId));
        assertTrue(ex.getMessage().contains("éléments sont rattachés"));
    }

    private void setId(Object entity, UUID id) {
        try {
            Field idField = entity.getClass().getDeclaredField("id");
            idField.setAccessible(true);
            idField.set(entity, id);
        } catch (Exception e) {
            throw new RuntimeException(e);
        }
    }
}
