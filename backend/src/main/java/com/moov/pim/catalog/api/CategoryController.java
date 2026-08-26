package com.moov.pim.catalog.api;

import com.moov.pim.catalog.api.dto.CategoryRequest;
import com.moov.pim.catalog.api.dto.CategoryResponse;
import com.moov.pim.catalog.service.CategoryService;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/categories")
public class CategoryController {

    private final CategoryService categoryService;

    public CategoryController(CategoryService categoryService) {
        this.categoryService = categoryService;
    }

    @PostMapping
    @PreAuthorize("hasAuthority('CATALOG_MANAGE')")
    public ResponseEntity<CategoryResponse> create(@Valid @RequestBody CategoryRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED).body(categoryService.create(request));
    }

    @PutMapping("/{id}")
    @PreAuthorize("hasAuthority('CATALOG_MANAGE')")
    public ResponseEntity<CategoryResponse> update(@PathVariable UUID id,
                                                    @Valid @RequestBody CategoryRequest request) {
        return ResponseEntity.ok(categoryService.update(id, request));
    }

    /**
     * Les quatre types de la classification.
     *
     * L'enumeration est figee cote serveur : c'est elle qui decide quelle entite
     * est creee et quel circuit s'applique. L'exposer evite que l'interface
     * maintienne sa propre liste, comme c'etait le cas des huit libelles de
     * categories jusqu'ici codes en dur dans l'ecran Catalogue.
     */
    @GetMapping("/types")
    @PreAuthorize("hasAuthority('CATALOG_READ')")
    public ResponseEntity<List<CategoryService.TypeSummary>> listTypes() {
        return ResponseEntity.ok(categoryService.listTypes());
    }

    /**
     * Categories racines, filtrables par type.
     *
     * @param type       PRODUCT, OFFER, SERVICE ou PACK. Toutes si absent.
     * @param activeOnly true dans les formulaires de classement, faux par defaut
     *                   pour l'ecran d'administration qui doit voir — et pouvoir
     *                   reactiver — les categories hors service.
     */
    @GetMapping
    @PreAuthorize("hasAuthority('CATALOG_READ')")
    public ResponseEntity<List<CategoryResponse>> listRoots(
            @RequestParam(required = false) String type,
            @RequestParam(required = false, defaultValue = "false") boolean activeOnly) {
        return ResponseEntity.ok(categoryService.listRoots(type, activeOnly));
    }

    /** Une categorie et son rattachement, pour repositionner un formulaire. */
    @GetMapping("/{id}")
    @PreAuthorize("hasAuthority('CATALOG_READ')")
    public ResponseEntity<CategoryResponse> getById(@PathVariable UUID id) {
        return ResponseEntity.ok(categoryService.getById(id));
    }

    @GetMapping("/{id}/children")
    @PreAuthorize("hasAuthority('CATALOG_READ')")
    public ResponseEntity<List<CategoryResponse>> listChildren(
            @PathVariable UUID id,
            @RequestParam(required = false, defaultValue = "false") boolean activeOnly) {
        return ResponseEntity.ok(categoryService.listChildren(id, activeOnly));
    }

    /** Retire la categorie et ses sous-categories des listes de selection. */
    @PatchMapping("/{id}/deactivate")
    @PreAuthorize("hasAuthority('CATALOG_MANAGE')")
    public ResponseEntity<CategoryResponse> deactivate(@PathVariable UUID id) {
        return ResponseEntity.ok(categoryService.deactivate(id));
    }

    /** Remet la categorie en service. */
    @PatchMapping("/{id}/reactivate")
    @PreAuthorize("hasAuthority('CATALOG_MANAGE')")
    public ResponseEntity<CategoryResponse> reactivate(@PathVariable UUID id) {
        return ResponseEntity.ok(categoryService.reactivate(id));
    }

    @DeleteMapping("/{id}")
    @PreAuthorize("hasAuthority('CATALOG_MANAGE')")
    public ResponseEntity<Void> delete(@PathVariable UUID id) {
        categoryService.delete(id);
        return ResponseEntity.noContent().build();
    }
}
