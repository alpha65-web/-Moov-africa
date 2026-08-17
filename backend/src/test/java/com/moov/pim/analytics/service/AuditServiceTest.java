package com.moov.pim.analytics.service;

import com.moov.pim.analytics.domain.AuditAction;
import com.moov.pim.analytics.domain.AuditLog;
import com.moov.pim.analytics.repository.AuditLogRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;

import java.lang.reflect.Field;
import java.util.List;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class AuditServiceTest {

    @Mock private AuditLogRepository auditLogRepository;

    @InjectMocks private AuditService auditService;

    @Test
    void log_shouldSaveAuditLogWithAllFields() {
        UUID userId = UUID.randomUUID();
        UUID entityId = UUID.randomUUID();

        when(auditLogRepository.save(any(AuditLog.class))).thenAnswer(inv -> {
            AuditLog log = inv.getArgument(0);
            setField(log, "id", UUID.randomUUID());
            return log;
        });

        AuditLog result = auditService.log(
                userId, AuditAction.CREATE, "Offer", entityId,
                null, "{\"name\":\"Offre\"}", "192.168.1.1", "Mozilla/5.0");

        assertNotNull(result);
        assertEquals(userId, result.getUserId());
        assertEquals(AuditAction.CREATE, result.getAction());
        assertEquals("Offer", result.getEntityType());
        assertEquals(entityId, result.getEntityId());
        assertEquals("192.168.1.1", result.getIpAddress());
        assertEquals("Mozilla/5.0", result.getUserAgent());
        verify(auditLogRepository).save(any());
    }

    @Test
    void log_shouldWorkWithoutUserAgent() {
        UUID userId = UUID.randomUUID();
        UUID entityId = UUID.randomUUID();

        when(auditLogRepository.save(any(AuditLog.class))).thenAnswer(inv -> {
            AuditLog log = inv.getArgument(0);
            setField(log, "id", UUID.randomUUID());
            return log;
        });

        AuditLog result = auditService.log(
                userId, AuditAction.DELETE, "Campaign", entityId,
                "{\"old\":true}", null, "10.0.0.1");

        assertNotNull(result);
        assertNull(result.getUserAgent());
        assertEquals(AuditAction.DELETE, result.getAction());
    }

    @Test
    void log_shouldSaveWithPreviousAndNewValues() {
        UUID userId = UUID.randomUUID();
        UUID entityId = UUID.randomUUID();
        String prev = "{\"status\":\"DRAFT\"}";
        String next = "{\"status\":\"PUBLISHED\"}";

        when(auditLogRepository.save(any(AuditLog.class))).thenAnswer(inv -> {
            AuditLog log = inv.getArgument(0);
            setField(log, "id", UUID.randomUUID());
            return log;
        });

        AuditLog result = auditService.log(
                userId, AuditAction.PUBLISH, "Offer", entityId,
                prev, next, "127.0.0.1", null);

        assertEquals(prev, result.getPreviousValue());
        assertEquals(next, result.getNewValue());
    }

    @Test
    void getRecentLogs_shouldReturnPagedResults() {
        UUID userId = UUID.randomUUID();
        AuditLog entry = new AuditLog(userId, AuditAction.LOGIN, "User", userId);
        setField(entry, "id", UUID.randomUUID());
        Pageable pageable = PageRequest.of(0, 10);
        Page<AuditLog> page = new PageImpl<>(List.of(entry), pageable, 1);

        when(auditLogRepository.findAllByOrderByCreatedAtDesc(pageable)).thenReturn(page);

        var result = auditService.getRecentLogs(pageable);

        assertEquals(1, result.getTotalElements());
        assertEquals("LOGIN", result.getContent().get(0).action());
    }

    @Test
    void getEntityHistory_shouldReturnPagedResults() {
        UUID entityId = UUID.randomUUID();
        AuditLog entry = new AuditLog(UUID.randomUUID(), AuditAction.UPDATE, "Offer", entityId);
        setField(entry, "id", UUID.randomUUID());
        Pageable pageable = PageRequest.of(0, 10);
        Page<AuditLog> page = new PageImpl<>(List.of(entry), pageable, 1);

        when(auditLogRepository.findByEntityTypeAndEntityIdOrderByCreatedAtDesc(
                eq("Offer"), eq(entityId), eq(pageable))).thenReturn(page);

        var result = auditService.getEntityHistory("Offer", entityId, pageable);

        assertEquals(1, result.getTotalElements());
        assertEquals(entityId, result.getContent().get(0).entityId());
    }

    @Test
    void getUserHistory_shouldReturnPagedResults() {
        UUID userId = UUID.randomUUID();
        AuditLog entry = new AuditLog(userId, AuditAction.CREATE, "Campaign", UUID.randomUUID());
        setField(entry, "id", UUID.randomUUID());
        Pageable pageable = PageRequest.of(0, 10);
        Page<AuditLog> page = new PageImpl<>(List.of(entry), pageable, 1);

        when(auditLogRepository.findByUserIdOrderByCreatedAtDesc(eq(userId), eq(pageable)))
                .thenReturn(page);

        var result = auditService.getUserHistory(userId, pageable);

        assertEquals(1, result.getTotalElements());
        assertEquals(userId, result.getContent().get(0).userId());
    }

    private static void setField(Object target, String fieldName, Object value) {
        try {
            Field field = target.getClass().getDeclaredField(fieldName);
            field.setAccessible(true);
            field.set(target, value);
        } catch (Exception e) {
            throw new RuntimeException(e);
        }
    }
}
