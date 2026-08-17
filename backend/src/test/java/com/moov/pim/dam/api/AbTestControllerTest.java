package com.moov.pim.dam.api;

import com.moov.pim.dam.api.dto.AbTestResponse;
import com.moov.pim.dam.api.dto.CreateAbTestRequest;
import com.moov.pim.dam.service.AbTestService;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.HttpStatus;

import java.util.List;
import java.util.Map;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class AbTestControllerTest {

    @Mock private AbTestService abTestService;
    @InjectMocks private AbTestController controller;

    @Test
    void create_shouldReturn201() {
        var request = mock(CreateAbTestRequest.class);
        var response = mock(AbTestResponse.class);
        when(abTestService.create(request)).thenReturn(response);

        var result = controller.create(request);

        assertEquals(HttpStatus.CREATED, result.getStatusCode());
        assertEquals(response, result.getBody());
    }

    @Test
    void getById_shouldReturn200() {
        UUID id = UUID.randomUUID();
        var response = mock(AbTestResponse.class);
        when(abTestService.getById(id)).thenReturn(response);

        var result = controller.getById(id);

        assertEquals(HttpStatus.OK, result.getStatusCode());
    }

    @Test
    void start_shouldReturn200() {
        UUID id = UUID.randomUUID();
        var response = mock(AbTestResponse.class);
        when(abTestService.start(id)).thenReturn(response);

        var result = controller.start(id);

        assertEquals(HttpStatus.OK, result.getStatusCode());
    }

    @Test
    void complete_shouldReturn200() {
        UUID id = UUID.randomUUID();
        var response = mock(AbTestResponse.class);
        when(abTestService.complete(id, "variantA")).thenReturn(response);

        var result = controller.complete(id, Map.of("winner", "variantA"));

        assertEquals(HttpStatus.OK, result.getStatusCode());
    }

    @Test
    void cancel_shouldReturn200() {
        UUID id = UUID.randomUUID();
        var response = mock(AbTestResponse.class);
        when(abTestService.cancel(id)).thenReturn(response);

        var result = controller.cancel(id);

        assertEquals(HttpStatus.OK, result.getStatusCode());
    }
}
