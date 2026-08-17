package com.moov.pim.catalog.api;

import com.moov.pim.catalog.api.dto.CatalogItemResponse;
import com.moov.pim.catalog.api.dto.ProductRequest;
import com.moov.pim.catalog.api.dto.ServiceRequest;
import com.moov.pim.catalog.api.dto.PackRequest;
import com.moov.pim.catalog.service.CatalogService;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.PageRequest;
import org.springframework.http.HttpStatus;

import java.util.List;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class CatalogControllerTest {

    @Mock private CatalogService catalogService;
    @InjectMocks private CatalogController controller;

    @Test
    void createProduct_shouldReturn201() {
        var request = mock(ProductRequest.class);
        var response = mock(CatalogItemResponse.class);
        when(catalogService.createProduct(request)).thenReturn(response);

        var result = controller.createProduct(request);

        assertEquals(HttpStatus.CREATED, result.getStatusCode());
        assertEquals(response, result.getBody());
    }

    @Test
    void createService_shouldReturn201() {
        var request = mock(ServiceRequest.class);
        var response = mock(CatalogItemResponse.class);
        when(catalogService.createService(request)).thenReturn(response);

        var result = controller.createService(request);

        assertEquals(HttpStatus.CREATED, result.getStatusCode());
    }

    @Test
    void createPack_shouldReturn201() {
        var request = mock(PackRequest.class);
        var response = mock(CatalogItemResponse.class);
        when(catalogService.createPack(request)).thenReturn(response);

        var result = controller.createPack(request);

        assertEquals(HttpStatus.CREATED, result.getStatusCode());
    }

    @Test
    void getById_shouldReturn200() {
        UUID id = UUID.randomUUID();
        var response = mock(CatalogItemResponse.class);
        when(catalogService.getById(id)).thenReturn(response);

        var result = controller.getById(id);

        assertEquals(HttpStatus.OK, result.getStatusCode());
        assertEquals(response, result.getBody());
    }

    @Test
    void archive_shouldReturn204() {
        UUID id = UUID.randomUUID();

        var result = controller.archive(id);

        assertEquals(HttpStatus.NO_CONTENT, result.getStatusCode());
        verify(catalogService).archive(id);
    }

    @Test
    void listAll_shouldReturn200() {
        var pageable = PageRequest.of(0, 10);
        Page<CatalogItemResponse> page = new PageImpl<>(List.of());
        when(catalogService.search(null, null, null, pageable)).thenReturn(page);

        var result = controller.listAll(null, null, null, pageable);

        assertEquals(HttpStatus.OK, result.getStatusCode());
        assertEquals(0, result.getBody().getTotalElements());
    }
}
