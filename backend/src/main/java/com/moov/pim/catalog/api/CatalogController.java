package com.moov.pim.catalog.api;

import com.moov.pim.catalog.api.dto.CatalogItemResponse;
import com.moov.pim.catalog.api.dto.PackRequest;
import com.moov.pim.catalog.api.dto.ProductRequest;
import com.moov.pim.catalog.api.dto.ServiceRequest;
import com.moov.pim.catalog.service.CatalogService;
import jakarta.validation.Valid;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.UUID;

@RestController
@RequestMapping("/catalog")
public class CatalogController {

    private final CatalogService catalogService;

    public CatalogController(CatalogService catalogService) {
        this.catalogService = catalogService;
    }

    @PostMapping("/products")
    @PreAuthorize("hasAuthority('CATALOG_MANAGE')")
    public ResponseEntity<CatalogItemResponse> createProduct(@Valid @RequestBody ProductRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED).body(catalogService.createProduct(request));
    }

    @PostMapping("/services")
    @PreAuthorize("hasAuthority('CATALOG_MANAGE')")
    public ResponseEntity<CatalogItemResponse> createService(@Valid @RequestBody ServiceRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED).body(catalogService.createService(request));
    }

    @PostMapping("/packs")
    @PreAuthorize("hasAuthority('CATALOG_MANAGE')")
    public ResponseEntity<CatalogItemResponse> createPack(@Valid @RequestBody PackRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED).body(catalogService.createPack(request));
    }

    @PutMapping("/products/{id}")
    @PreAuthorize("hasAuthority('CATALOG_MANAGE')")
    public ResponseEntity<CatalogItemResponse> updateProduct(@PathVariable UUID id,
                                                              @Valid @RequestBody ProductRequest request) {
        return ResponseEntity.ok(catalogService.updateProduct(id, request));
    }

    @PutMapping("/services/{id}")
    @PreAuthorize("hasAuthority('CATALOG_MANAGE')")
    public ResponseEntity<CatalogItemResponse> updateService(@PathVariable UUID id,
                                                              @Valid @RequestBody ServiceRequest request) {
        return ResponseEntity.ok(catalogService.updateService(id, request));
    }

    @PutMapping("/packs/{id}")
    @PreAuthorize("hasAuthority('CATALOG_MANAGE')")
    public ResponseEntity<CatalogItemResponse> updatePack(@PathVariable UUID id,
                                                           @Valid @RequestBody PackRequest request) {
        return ResponseEntity.ok(catalogService.updatePack(id, request));
    }

    @GetMapping
    @PreAuthorize("hasAuthority('CATALOG_READ')")
    public ResponseEntity<Page<CatalogItemResponse>> listAll(
            @RequestParam(required = false) String search,
            @RequestParam(required = false) UUID categoryId,
            @RequestParam(required = false) String type,
            Pageable pageable) {
        return ResponseEntity.ok(catalogService.search(search, categoryId, type, pageable));
    }

    @GetMapping("/{id}")
    @PreAuthorize("hasAuthority('CATALOG_READ')")
    public ResponseEntity<CatalogItemResponse> getById(@PathVariable UUID id) {
        return ResponseEntity.ok(catalogService.getById(id));
    }

    @DeleteMapping("/{id}")
    @PreAuthorize("hasAuthority('CATALOG_MANAGE')")
    public ResponseEntity<Void> archive(@PathVariable UUID id) {
        catalogService.archive(id);
        return ResponseEntity.noContent().build();
    }
}
