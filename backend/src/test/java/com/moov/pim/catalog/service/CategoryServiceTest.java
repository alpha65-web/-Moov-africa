package com.moov.pim.catalog.service;

import com.moov.pim.catalog.api.dto.CategoryRequest;
import com.moov.pim.catalog.api.dto.CategoryResponse;
import com.moov.pim.catalog.domain.Category;
import com.moov.pim.catalog.domain.ItemType;
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
    void create_shouldCreateRootCategoryOfRequestedType() {
        CategoryRequest request = new CategoryRequest("Téléphones", "Terminaux", "PRODUCT", null);

        when(categoryRepository.existsByTypeAndParentIsNullAndNameIgnoreCase(ItemType.PRODUCT, "Téléphones"))
                .thenReturn(false);
        when(categoryRepository.save(any(Category.class))).thenAnswer(inv -> {
            Category c = inv.getArgument(0);
            setId(c, UUID.randomUUID());
            return c;
        });

        CategoryResponse response = categoryService.create(request);

        assertEquals("Téléphones", response.name());
        assertEquals("PRODUCT", response.type());
        assertEquals("Produit", response.typeLabel());
        assertEquals(0, response.level());
        assertTrue(response.active());
        assertNull(response.parentId());
    }

    @Test
    void create_shouldRejectUnknownType() {
        CategoryRequest request = new CategoryRequest("Divers", null, "FORFAIT", null);

        IllegalArgumentException ex = assertThrows(IllegalArgumentException.class,
                () -> categoryService.create(request));
        assertTrue(ex.getMessage().contains("Type inconnu"));
    }

    @Test
    void create_shouldRequireTypeForRootCategory() {
        CategoryRequest request = new CategoryRequest("Divers", null, null, null);

        IllegalArgumentException ex = assertThrows(IllegalArgumentException.class,
                () -> categoryService.create(request));
        assertTrue(ex.getMessage().contains("type est obligatoire"));
    }

    @Test
    void create_shouldInheritTypeFromParent() {
        UUID parentId = UUID.randomUUID();
        Category parent = root("Internet mobile", ItemType.OFFER, parentId);

        CategoryRequest request = new CategoryRequest("Forfaits Data", "Forfaits Internet", null, parentId);

        when(categoryRepository.findById(parentId)).thenReturn(Optional.of(parent));
        when(categoryRepository.existsByTypeAndParentIdAndNameIgnoreCase(ItemType.OFFER, parentId, "Forfaits Data"))
                .thenReturn(false);
        when(categoryRepository.save(any(Category.class))).thenAnswer(inv -> {
            Category c = inv.getArgument(0);
            setId(c, UUID.randomUUID());
            return c;
        });

        CategoryResponse response = categoryService.create(request);

        assertEquals("OFFER", response.type());
        assertEquals(1, response.level());
        assertEquals(parentId, response.parentId());
    }

    @Test
    void create_shouldRejectSubCategoryContradictingParentType() {
        UUID parentId = UUID.randomUUID();
        Category parent = root("Internet mobile", ItemType.OFFER, parentId);

        CategoryRequest request = new CategoryRequest("Routeurs", null, "PRODUCT", parentId);

        when(categoryRepository.findById(parentId)).thenReturn(Optional.of(parent));

        IllegalArgumentException ex = assertThrows(IllegalArgumentException.class,
                () -> categoryService.create(request));
        assertTrue(ex.getMessage().contains("hérite du type"));
        verify(categoryRepository, never()).save(any(Category.class));
    }

    @Test
    void create_shouldRefuseThirdLevel() {
        UUID parentId = UUID.randomUUID();
        Category subCategory = new Category("Forfaits Data", null, root("Internet mobile", ItemType.OFFER, UUID.randomUUID()), 1, ItemType.OFFER);
        setId(subCategory, parentId);

        CategoryRequest request = new CategoryRequest("Trop profond", null, null, parentId);

        when(categoryRepository.findById(parentId)).thenReturn(Optional.of(subCategory));

        IllegalArgumentException ex = assertThrows(IllegalArgumentException.class,
                () -> categoryService.create(request));
        assertTrue(ex.getMessage().contains("s'arrête à la sous-catégorie"));
    }

    @Test
    void create_shouldRefuseSubCategoryUnderInactiveParent() {
        UUID parentId = UUID.randomUUID();
        Category parent = root("Data", ItemType.OFFER, parentId);
        parent.setActive(false);

        when(categoryRepository.findById(parentId)).thenReturn(Optional.of(parent));

        CategoryRequest request = new CategoryRequest("Forfaits Data", null, null, parentId);

        assertThrows(IllegalStateException.class, () -> categoryService.create(request));
    }

    @Test
    void create_shouldRejectDuplicateNameWithinSameType() {
        CategoryRequest request = new CategoryRequest("Internet mobile", null, "OFFER", null);

        when(categoryRepository.existsByTypeAndParentIsNullAndNameIgnoreCase(ItemType.OFFER, "Internet mobile"))
                .thenReturn(true);

        IllegalArgumentException ex = assertThrows(IllegalArgumentException.class,
                () -> categoryService.create(request));
        assertTrue(ex.getMessage().contains("existe déjà"));
    }

    @Test
    void update_shouldRenameCategory() {
        UUID id = UUID.randomUUID();
        Category category = root("Ancien", ItemType.SERVICE, id);

        when(categoryRepository.findById(id)).thenReturn(Optional.of(category));
        when(categoryRepository.existsByTypeAndParentIsNullAndNameIgnoreCase(ItemType.SERVICE, "Nouveau"))
                .thenReturn(false);
        when(categoryRepository.save(any(Category.class))).thenAnswer(inv -> inv.getArgument(0));

        CategoryResponse response = categoryService.update(id, new CategoryRequest("Nouveau", "Desc", null, null));

        assertEquals("Nouveau", response.name());
        assertEquals("Desc", response.description());
    }

    @Test
    void update_shouldRefuseTypeChange() {
        UUID id = UUID.randomUUID();
        Category category = root("Services financiers", ItemType.SERVICE, id);

        when(categoryRepository.findById(id)).thenReturn(Optional.of(category));

        IllegalArgumentException ex = assertThrows(IllegalArgumentException.class,
                () -> categoryService.update(id, new CategoryRequest("Services financiers", null, "OFFER", null)));
        assertTrue(ex.getMessage().contains("ne se change pas"));
    }

    @Test
    void deactivate_shouldAlsoDeactivateChildren() {
        UUID id = UUID.randomUUID();
        Category parent = root("Data", ItemType.OFFER, id);
        Category child = new Category("Forfaits Data", null, parent, 1, ItemType.OFFER);
        setId(child, UUID.randomUUID());

        when(categoryRepository.findById(id)).thenReturn(Optional.of(parent));
        when(categoryRepository.findByParentIdOrderByNameAsc(id)).thenReturn(List.of(child));
        when(categoryRepository.save(any(Category.class))).thenAnswer(inv -> inv.getArgument(0));

        CategoryResponse response = categoryService.deactivate(id);

        assertFalse(response.active());
        assertFalse(child.isActive());
    }

    @Test
    void reactivate_shouldRefuseWhenParentIsInactive() {
        UUID id = UUID.randomUUID();
        Category parent = root("Data", ItemType.OFFER, UUID.randomUUID());
        parent.setActive(false);
        Category child = new Category("Forfaits Data", null, parent, 1, ItemType.OFFER);
        setId(child, id);

        when(categoryRepository.findById(id)).thenReturn(Optional.of(child));

        IllegalStateException ex = assertThrows(IllegalStateException.class,
                () -> categoryService.reactivate(id));
        assertTrue(ex.getMessage().contains("Réactivez d'abord"));
    }

    @Test
    void listRoots_shouldFilterByTypeWhenRequested() {
        Category root = root("Internet mobile", ItemType.OFFER, UUID.randomUUID());

        when(categoryRepository.findByTypeAndParentIsNullAndActiveTrueOrderByNameAsc(ItemType.OFFER))
                .thenReturn(List.of(root));

        List<CategoryResponse> results = categoryService.listRoots("OFFER", true);

        assertEquals(1, results.size());
        assertEquals("Internet mobile", results.get(0).name());
    }

    @Test
    void listChildren_shouldReturnSubCategories() {
        UUID parentId = UUID.randomUUID();
        Category parent = root("Services financiers", ItemType.SERVICE, parentId);
        Category child = new Category("Moov Money", null, parent, 1, ItemType.SERVICE);
        setId(child, UUID.randomUUID());

        when(categoryRepository.findByParentIdOrderByNameAsc(parentId)).thenReturn(List.of(child));

        List<CategoryResponse> results = categoryService.listChildren(parentId, false);

        assertEquals(1, results.size());
        assertEquals("Moov Money", results.get(0).name());
        assertEquals(parentId, results.get(0).parentId());
    }

    @Test
    void listTypes_shouldExposeTheFourFixedTypes() {
        when(categoryRepository.findByTypeOrderByNameAsc(any(ItemType.class))).thenReturn(List.of());

        List<CategoryService.TypeSummary> types = categoryService.listTypes();

        assertEquals(4, types.size());
        assertEquals(List.of("PRODUCT", "OFFER", "SERVICE", "PACK"),
                types.stream().map(CategoryService.TypeSummary::code).toList());
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
        Category child = new Category("Enfant", "E", null, 1, ItemType.SERVICE);
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

    private Category root(String name, ItemType type, UUID id) {
        Category category = new Category(name, null, null, 0, type);
        setId(category, id);
        return category;
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
