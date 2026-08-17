package com.moov.pim.notification.api;

import com.moov.pim.notification.api.dto.NotificationConfigResponse;
import com.moov.pim.notification.api.dto.UpdateNotificationConfigRequest;
import com.moov.pim.notification.service.NotificationConfigService;
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
class NotificationConfigControllerTest {

    @Mock private NotificationConfigService configService;
    @InjectMocks private NotificationConfigController controller;

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
        var request = mock(UpdateNotificationConfigRequest.class);
        var response = mock(NotificationConfigResponse.class);
        when(configService.update(id, request)).thenReturn(response);

        var result = controller.update(id, request);

        assertEquals(HttpStatus.OK, result.getStatusCode());
        assertEquals(response, result.getBody());
    }
}
