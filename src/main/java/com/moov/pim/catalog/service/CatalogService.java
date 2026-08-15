package com.moov.pim.catalog.service;

import com.moov.pim.catalog.api.dto.CatalogItemResponse;
import com.moov.pim.catalog.api.dto.PackRequest;
import com.moov.pim.catalog.api.dto.ProductRequest;
import com.moov.pim.catalog.api.dto.ServiceRequest;
import com.moov.pim.catalog.domain.CatalogItem;
import com.moov.pim.catalog.domain.CatalogItemStatus;
import com.moov.pim.catalog.domain.Pack;
import com.moov.pim.catalog.domain.PackItem;
import com.moov.pim.catalog.domain.Product;
import com.moov.pim.catalog.domain.Service;
import com.moov.pim.catalog.repository.CatalogItemRepository;
import com.moov.pim.catalog.repository.PackRepository;
import com.moov.pim.catalog.repository.ProductRepository;
import com.moov.pim.catalog.repository.ServiceRepository;
import com.moov.pim.permissions.security.CustomUserDetails;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.UUID;

@org.springframework.stereotype.Service
public class CatalogService {

    private final CatalogItemRepository catalogItemRepository;
    private final ProductRepository productRepository;
    private final ServiceRepository serviceRepository;
    private final PackRepository packRepository;

    public CatalogService(CatalogItemRepository catalogItemRepository,
                          ProductRepository productRepository,
                          ServiceRepository serviceRepository,
                          PackRepository packRepository) {
        this.catalogItemRepository = catalogItemRepository;
        this.productRepository = productRepository;
        this.serviceRepository = serviceRepository;
        this.packRepository = packRepository;
    }

    @Transactional
    public CatalogItemResponse createProduct(ProductRequest request) {
        Product product = new Product();
        product.setName(request.name());
        product.setDescription(request.description());
        product.setBasePrice(request.basePrice());
        product.setCategoryId(request.categoryId());
        product.setCharacteristics(request.characteristics());
        product.setPackOnly(request.packOnly());
        product.setCreatedById(currentUserId());
        product = productRepository.save(product);
        return CatalogItemResponse.from(product);
    }

    @Transactional
    public CatalogItemResponse createService(ServiceRequest request) {
        Service service = new Service();
        service.setName(request.name());
        service.setDescription(request.description());
        service.setBasePrice(request.basePrice());
        service.setCategoryId(request.categoryId());
        service.setServiceType(request.serviceType());
        service.setBillingCycle(request.billingCycle());
        service.setCharacteristics(request.characteristics());
        service.setPackOnly(request.packOnly());
        service.setCreatedById(currentUserId());
        service = serviceRepository.save(service);
        return CatalogItemResponse.from(service);
    }

    @Transactional
    public CatalogItemResponse createPack(PackRequest request) {
        Pack pack = new Pack();
        pack.setName(request.name());
        pack.setDescription(request.description());
        pack.setBasePrice(request.basePrice());
        pack.setCategoryId(request.categoryId());
        pack.setBundlePrice(request.bundlePrice());
        pack.setBundleDiscount(request.bundleDiscount());
        pack.setCreatedById(currentUserId());

        for (PackRequest.PackItemRequest itemReq : request.items()) {
            if (!catalogItemRepository.existsById(itemReq.catalogItemId())) {
                throw new IllegalArgumentException("Élément du catalogue introuvable : " + itemReq.catalogItemId());
            }
            pack.addItem(new PackItem(itemReq.catalogItemId(), itemReq.quantity()));
        }

        pack = packRepository.save(pack);
        return CatalogItemResponse.from(pack);
    }

    @Transactional(readOnly = true)
    public List<CatalogItemResponse> listAll() {
        return catalogItemRepository.findByStatus(CatalogItemStatus.ACTIVE).stream()
                .map(CatalogItemResponse::from)
                .toList();
    }

    @Transactional(readOnly = true)
    public CatalogItemResponse getById(UUID id) {
        CatalogItem item = catalogItemRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Élément du catalogue introuvable"));
        return CatalogItemResponse.from(item);
    }

    @Transactional
    public void archive(UUID id) {
        CatalogItem item = catalogItemRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Élément du catalogue introuvable"));
        item.setStatus(CatalogItemStatus.ARCHIVED);
        catalogItemRepository.save(item);
    }

    private UUID currentUserId() {
        CustomUserDetails principal = (CustomUserDetails) SecurityContextHolder
                .getContext().getAuthentication().getPrincipal();
        return principal.getUserId();
    }
}
