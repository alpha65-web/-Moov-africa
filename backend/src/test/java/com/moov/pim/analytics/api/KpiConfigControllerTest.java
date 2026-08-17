package com.moov.pim.analytics.api;

import com.moov.pim.analytics.api.dto.KpiConfigResponse;
import com.moov.pim.analytics.api.dto.UpdateKpiConfigRequest;
import com.moov.pim.analytics.service.KpiConfigService;
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
class KpiConfigControllerTest {

    @Mock private KpiConfigService configService;
    @InjectMocks private KpiConfigController controller;

    @Test
    void listAll_shouldReturn200() {
        when(configService.listAll()).thenReturn(List.of());

        var result = controller.listAll();

        assertEquals(HttpStatus.OK, result.getStatusCode());
        assertTrue(result.getBody().isEmpty());
    }

    @Test
    void update_shouldReturn200() {
        UUID id = UUID.randomUUID();
        var request = mock(UpdateKpiConfigRequest.class);
        var response = mock(KpiConfigResponse.class);
        when(configService.update(id, request)).thenReturn(response);

        var result = controller.update(id, request);

        assertEquals(HttpStatus.OK, result.getStatusCode());
        assertEquals(response, result.getBody());
    }
}
