package com.moov.pim.analytics.api;

import com.moov.pim.analytics.api.dto.AuditLogResponse;
import com.moov.pim.analytics.service.AuditService;
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
class AuditControllerTest {

    @Mock private AuditService auditService;
    @InjectMocks private AuditController controller;

    @Test
    void recent_shouldReturn200() {
        var pageable = PageRequest.of(0, 10);
        when(auditService.getRecentLogs(pageable)).thenReturn(new PageImpl<>(List.of()));

        var result = controller.recent(pageable);

        assertEquals(HttpStatus.OK, result.getStatusCode());
        assertEquals(0, result.getBody().getTotalElements());
    }

    @Test
    void entityHistory_shouldReturn200() {
        UUID entityId = UUID.randomUUID();
        var pageable = PageRequest.of(0, 10);
        when(auditService.getEntityHistory("Offer", entityId, pageable))
                .thenReturn(new PageImpl<>(List.of()));

        var result = controller.entityHistory("Offer", entityId, pageable);

        assertEquals(HttpStatus.OK, result.getStatusCode());
    }

    @Test
    void userHistory_shouldReturn200() {
        UUID userId = UUID.randomUUID();
        var pageable = PageRequest.of(0, 10);
        when(auditService.getUserHistory(userId, pageable))
                .thenReturn(new PageImpl<>(List.of()));

        var result = controller.userHistory(userId, pageable);

        assertEquals(HttpStatus.OK, result.getStatusCode());
    }
}
