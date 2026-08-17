package com.moov.pim.catalog.api;

import com.moov.pim.catalog.api.dto.CategoryRequest;
import com.moov.pim.catalog.api.dto.CategoryResponse;
import com.moov.pim.catalog.service.CategoryService;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.HttpStatus;

import java.util.List;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class CategoryControllerTest {

    @Mock private CategoryService categoryService;
    @InjectMocks private CategoryController controller;

    @Test
    void create_shouldReturn201() {
        var request = mock(CategoryRequest.class);
        var response = mock(CategoryResponse.class);
        when(categoryService.create(request)).thenReturn(response);

        var result = controller.create(request);

        assertEquals(HttpStatus.CREATED, result.getStatusCode());
        assertEquals(response, result.getBody());
    }

    @Test
    void listRoots_shouldReturn200() {
        when(categoryService.listRoots()).thenReturn(List.of());

        var result = controller.listRoots();

        assertEquals(HttpStatus.OK, result.getStatusCode());
        assertTrue(result.getBody().isEmpty());
    }

    @Test
    void listChildren_shouldReturn200() {
        UUID id = UUID.randomUUID();
        when(categoryService.listChildren(id)).thenReturn(List.of());

        var result = controller.listChildren(id);

        assertEquals(HttpStatus.OK, result.getStatusCode());
    }

    @Test
    void delete_shouldReturn204() {
        UUID id = UUID.randomUUID();

        var result = controller.delete(id);

        assertEquals(HttpStatus.NO_CONTENT, result.getStatusCode());
        verify(categoryService).delete(id);
    }
}
