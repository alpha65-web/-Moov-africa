package com.moov.pim.permissions.api;

import com.moov.pim.permissions.api.dto.GdprExportResponse;
import com.moov.pim.permissions.security.CustomUserDetails;
import com.moov.pim.shared.security.DataAnonymizationService;
import com.moov.pim.shared.security.GdprExportService;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.HttpStatus;

import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class GdprControllerTest {

    @Mock private DataAnonymizationService anonymizationService;
    @Mock private GdprExportService gdprExportService;
    @InjectMocks private GdprController controller;

    @Test
    void exportUserData_shouldReturn200() {
        UUID userId = UUID.randomUUID();
        UUID principalId = UUID.randomUUID();
        var principal = mock(CustomUserDetails.class);
        when(principal.getUserId()).thenReturn(principalId);
        var response = mock(GdprExportResponse.class);
        when(gdprExportService.exportUserData(userId, principalId)).thenReturn(response);

        var result = controller.exportUserData(userId, principal);

        assertEquals(HttpStatus.OK, result.getStatusCode());
        assertEquals(response, result.getBody());
    }

    @Test
    void anonymizeUser_shouldReturn204() {
        UUID userId = UUID.randomUUID();
        UUID principalId = UUID.randomUUID();
        var principal = mock(CustomUserDetails.class);
        when(principal.getUserId()).thenReturn(principalId);

        var result = controller.anonymizeUser(userId, principal);

        assertEquals(HttpStatus.NO_CONTENT, result.getStatusCode());
        verify(anonymizationService).anonymizeUser(userId, principalId);
    }
}
