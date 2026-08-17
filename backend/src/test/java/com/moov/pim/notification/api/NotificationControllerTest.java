package com.moov.pim.notification.api;

import com.moov.pim.notification.service.NotificationService;
import com.moov.pim.permissions.security.CustomUserDetails;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.PageRequest;
import org.springframework.http.HttpStatus;

import java.util.List;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class NotificationControllerTest {

    @Mock private NotificationService notificationService;
    @InjectMocks private NotificationController controller;

    @Test
    void unreadCount_shouldReturn200() {
        UUID userId = UUID.randomUUID();
        var principal = mock(CustomUserDetails.class);
        when(principal.getUserId()).thenReturn(userId);
        when(notificationService.countUnread(userId)).thenReturn(5L);

        var result = controller.unreadCount(principal);

        assertEquals(HttpStatus.OK, result.getStatusCode());
        assertEquals(5L, result.getBody().get("count"));
    }

    @Test
    void markAsRead_shouldReturn204() {
        UUID id = UUID.randomUUID();

        var result = controller.markAsRead(id);

        assertEquals(HttpStatus.NO_CONTENT, result.getStatusCode());
        verify(notificationService).markAsRead(id);
    }

    @Test
    void markAllAsRead_shouldReturn204() {
        UUID userId = UUID.randomUUID();
        var principal = mock(CustomUserDetails.class);
        when(principal.getUserId()).thenReturn(userId);

        var result = controller.markAllAsRead(principal);

        assertEquals(HttpStatus.NO_CONTENT, result.getStatusCode());
        verify(notificationService).markAllAsRead(userId);
    }

    @Test
    void delete_shouldReturn204() {
        UUID id = UUID.randomUUID();

        var result = controller.delete(id);

        assertEquals(HttpStatus.NO_CONTENT, result.getStatusCode());
        verify(notificationService).delete(id);
    }
}
