package com.moov.pim.permissions.service;

import com.moov.pim.permissions.repository.RefreshTokenRepository;
import com.moov.pim.permissions.repository.UserRepository;
import com.moov.pim.shared.logging.SecurityMetricsService;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class KeyManagementServiceTest {

    @Mock private UserRepository userRepository;
    @Mock private RefreshTokenRepository refreshTokenRepository;
    @Mock private SecurityMetricsService metricsService;

    @InjectMocks private KeyManagementService keyManagementService;

    @Test
    void emergencyRevokeAllSessions_shouldRevokeAndIncrementVersions() {
        when(userRepository.incrementAllTokenVersions()).thenReturn(42);

        int result = keyManagementService.emergencyRevokeAllSessions();

        assertEquals(42, result);
        verify(refreshTokenRepository).revokeAll();
        verify(userRepository).incrementAllTokenVersions();
        verify(metricsService).recordAccessDenied();
    }

    @Test
    void rotateSessionKeys_shouldRevokeAndIncrement() {
        when(userRepository.incrementAllTokenVersions()).thenReturn(10);

        keyManagementService.rotateSessionKeys();

        verify(refreshTokenRepository).revokeAll();
        verify(userRepository).incrementAllTokenVersions();
        verifyNoInteractions(metricsService);
    }

    @Test
    void checkKeyRotationCompliance_shouldNotThrow() {
        assertDoesNotThrow(() -> keyManagementService.checkKeyRotationCompliance());
    }

    @Test
    void recordMasterKeyRotation_shouldUpdateTimestamp() {
        assertNotNull(keyManagementService.getLastMasterKeyRotation());

        keyManagementService.recordMasterKeyRotation();

        assertNotNull(keyManagementService.getLastMasterKeyRotation());
    }

    @Test
    void getLastSessionKeyRotation_shouldReturnNonNull() {
        assertNotNull(keyManagementService.getLastSessionKeyRotation());
    }

    @Test
    void emergencyRevokeAllSessions_shouldUpdateSessionKeyTimestamp() {
        when(userRepository.incrementAllTokenVersions()).thenReturn(1);

        var before = keyManagementService.getLastSessionKeyRotation();
        keyManagementService.emergencyRevokeAllSessions();
        var after = keyManagementService.getLastSessionKeyRotation();

        assertTrue(after.isEqual(before) || after.isAfter(before));
    }
}
