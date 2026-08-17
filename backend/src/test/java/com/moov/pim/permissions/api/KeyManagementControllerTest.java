package com.moov.pim.permissions.api;

import com.moov.pim.permissions.service.KeyManagementService;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.HttpStatus;

import java.time.LocalDateTime;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class KeyManagementControllerTest {

    @Mock private KeyManagementService keyManagementService;
    @InjectMocks private KeyManagementController controller;

    @Test
    void emergencyRevokeAll_shouldReturn200() {
        when(keyManagementService.emergencyRevokeAllSessions()).thenReturn(42);

        var result = controller.emergencyRevokeAll();

        assertEquals(HttpStatus.OK, result.getStatusCode());
        assertEquals("ALL_SESSIONS_REVOKED", result.getBody().get("status"));
        assertEquals(42, result.getBody().get("affectedUsers"));
    }

    @Test
    void rotateSessionKeys_shouldReturn200() {
        var result = controller.rotateSessionKeys();

        assertEquals(HttpStatus.OK, result.getStatusCode());
        assertEquals("SESSION_KEYS_ROTATED", result.getBody().get("status"));
        verify(keyManagementService).rotateSessionKeys();
    }

    @Test
    void acknowledgeMasterKeyRotation_shouldReturn200() {
        var result = controller.acknowledgeMasterKeyRotation();

        assertEquals(HttpStatus.OK, result.getStatusCode());
        assertEquals("MASTER_KEY_ROTATION_RECORDED", result.getBody().get("status"));
        verify(keyManagementService).recordMasterKeyRotation();
    }

    @Test
    void keyStatus_shouldReturn200() {
        var now = LocalDateTime.now();
        when(keyManagementService.getLastSessionKeyRotation()).thenReturn(now);
        when(keyManagementService.getLastMasterKeyRotation()).thenReturn(now);

        var result = controller.keyStatus();

        assertEquals(HttpStatus.OK, result.getStatusCode());
        assertNotNull(result.getBody().get("lastSessionKeyRotation"));
    }
}
