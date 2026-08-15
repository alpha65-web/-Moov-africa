package com.moov.pim.catalog.service;

import com.moov.pim.catalog.api.dto.CatalogItemResponse;
import com.moov.pim.catalog.api.dto.PackRequest;
import com.moov.pim.catalog.api.dto.ProductRequest;
import com.moov.pim.catalog.api.dto.ServiceRequest;
import com.moov.pim.catalog.domain.BillingCycle;
import com.moov.pim.catalog.domain.CatalogItem;
import com.moov.pim.catalog.domain.CatalogItemStatus;
import com.moov.pim.catalog.domain.Pack;
import com.moov.pim.catalog.domain.Product;
import com.moov.pim.catalog.domain.Service;
import com.moov.pim.catalog.domain.ServiceType;
import com.moov.pim.catalog.repository.CatalogItemRepository;
import com.moov.pim.catalog.repository.PackRepository;
import com.moov.pim.catalog.repository.ProductRepository;
import com.moov.pim.catalog.repository.ServiceRepository;
import com.moov.pim.permissions.domain.Role;
import com.moov.pim.permissions.domain.RoleName;
import com.moov.pim.permissions.domain.User;
import com.moov.pim.permissions.security.CustomUserDetails;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;

import java.lang.reflect.Field;
import java.math.BigDecimal;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class CatalogServiceTest {

    @Mock private CatalogItemRepository catalogItemRepository;
    @Mock private ProductRepository productRepository;
    @Mock private ServiceRepository serviceRepository;
    @Mock private PackRepository packRepository;

    @InjectMocks private CatalogService catalogService;

    private UUID userId;

    @BeforeEach
    void setUp() throws Exception {
        userId = UUID.randomUUID();
        var constructor = Role.class.getDeclaredConstructor();
        constructor.setAccessible(true);
        Role role = constructor.newInstance();
        Field nameField = Role.class.getDeclaredField("name");
        nameField.setAccessible(true);
        nameField.set(role, RoleName.CHEF_PRODUIT);

        User user = new User("chef@moov.bf", "$2a$hash", "Chef", "Produit", role);
        Field idField = User.class.getDeclaredField("id");
        idField.setAccessible(true);
        idField.set(user, userId);

        CustomUserDetails details = new CustomUserDetails(user);
        SecurityContextHolder.getContext().setAuthentication(
                new UsernamePasswordAuthenticationToken(details, null, details.getAuthorities()));
    }

    @AfterEach
    void tearDown() {
        SecurityContextHolder.clearContext();
    }

    @Test
    void createProduct_shouldReturnProductResponse() {
        UUID categoryId = UUID.randomUUID();
        ProductRequest request = new ProductRequest(
                "SIM 4G", "Carte SIM 4G", new BigDecimal("500"),
                categoryId, "{\"type\":\"nano\"}", false);

        when(productRepository.save(any(Product.class))).thenAnswer(inv -> {
            Product p = inv.getArgument(0);
            setId(p, UUID.randomUUID());
            return p;
        });

        CatalogItemResponse response = catalogService.createProduct(request);

        assertNotNull(response);
        assertEquals("SIM 4G", response.name());
        assertEquals("PRODUCT", response.type());
        verify(productRepository).save(any(Product.class));
    }

    @Test
    void createService_shouldReturnServiceResponse() {
        ServiceRequest request = new ServiceRequest(
                "Internet Fibre", "Abonnement fibre optique", new BigDecimal("25000"),
                UUID.randomUUID(), ServiceType.DATA, BillingCycle.MONTHLY,
                "{\"debit\":\"100Mbps\"}", false);

        when(serviceRepository.save(any(Service.class))).thenAnswer(inv -> {
            Service s = inv.getArgument(0);
            setId(s, UUID.randomUUID());
            return s;
        });

        CatalogItemResponse response = catalogService.createService(request);

        assertNotNull(response);
        assertEquals("Internet Fibre", response.name());
        assertEquals("SERVICE", response.type());
    }

    @Test
    void createPack_shouldValidateItems() {
        UUID itemId = UUID.randomUUID();
        PackRequest request = new PackRequest(
                "Pack Pro", "Pack entreprise", new BigDecimal("50000"),
                UUID.randomUUID(), new BigDecimal("45000"), new BigDecimal("10"),
                List.of(new PackRequest.PackItemRequest(itemId, 2)));

        when(catalogItemRepository.existsById(itemId)).thenReturn(true);
        when(packRepository.save(any(Pack.class))).thenAnswer(inv -> {
            Pack p = inv.getArgument(0);
            setId(p, UUID.randomUUID());
            return p;
        });

        CatalogItemResponse response = catalogService.createPack(request);

        assertNotNull(response);
        assertEquals("Pack Pro", response.name());
        assertEquals("PACK", response.type());
    }

    @Test
    void createPack_shouldThrowIfItemNotFound() {
        UUID missingId = UUID.randomUUID();
        PackRequest request = new PackRequest(
                "Pack", "Desc", new BigDecimal("10000"),
                UUID.randomUUID(), new BigDecimal("9000"), new BigDecimal("10"),
                List.of(new PackRequest.PackItemRequest(missingId, 1)));

        when(catalogItemRepository.existsById(missingId)).thenReturn(false);

        IllegalArgumentException ex = assertThrows(IllegalArgumentException.class,
                () -> catalogService.createPack(request));
        assertTrue(ex.getMessage().contains("introuvable"));
    }

    @Test
    void listAll_shouldReturnActiveItems() {
        Product product = new Product();
        product.setName("Produit A");
        setId(product, UUID.randomUUID());

        when(catalogItemRepository.findByStatus(CatalogItemStatus.ACTIVE))
                .thenReturn(List.of(product));

        List<CatalogItemResponse> results = catalogService.listAll();

        assertEquals(1, results.size());
        assertEquals("Produit A", results.get(0).name());
    }

    @Test
    void getById_shouldThrowIfNotFound() {
        UUID fakeId = UUID.randomUUID();
        when(catalogItemRepository.findById(fakeId)).thenReturn(Optional.empty());

        assertThrows(IllegalArgumentException.class, () -> catalogService.getById(fakeId));
    }

    @Test
    void archive_shouldSetStatusToArchived() {
        Product product = new Product();
        product.setName("Old Product");
        UUID productId = UUID.randomUUID();
        setId(product, productId);

        when(catalogItemRepository.findById(productId)).thenReturn(Optional.of(product));
        when(catalogItemRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));

        catalogService.archive(productId);

        assertEquals(CatalogItemStatus.ARCHIVED, product.getStatus());
    }

    private void setId(Object entity, UUID id) {
        try {
            Class<?> clazz = entity.getClass();
            while (clazz != null) {
                try {
                    Field idField = clazz.getDeclaredField("id");
                    idField.setAccessible(true);
                    idField.set(entity, id);
                    return;
                } catch (NoSuchFieldException e) {
                    clazz = clazz.getSuperclass();
                }
            }
        } catch (Exception e) {
            throw new RuntimeException(e);
        }
    }
}
