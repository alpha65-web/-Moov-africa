package com.moov.pim.integration.service;

import com.moov.pim.integration.api.dto.IntegrationExportResponse;
import com.moov.pim.integration.domain.ExportStatus;
import com.moov.pim.integration.domain.ExportType;
import com.moov.pim.integration.domain.IntegrationExport;
import com.moov.pim.integration.domain.TargetSystem;
import com.moov.pim.integration.repository.IntegrationExportRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.lang.reflect.Field;
import java.util.Collections;
import java.util.List;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class IntegrationExportServiceTest {

    @Mock private IntegrationExportRepository exportRepository;

    @InjectMocks private IntegrationExportService exportService;

    @Test
    void triggerAutoExport_shouldExportToAllTargetSystems() {
        UUID offerId = UUID.randomUUID();

        when(exportRepository.existsByOfferIdAndTargetSystemAndStatus(
                eq(offerId), any(), eq(ExportStatus.SUCCESS))).thenReturn(false);
        when(exportRepository.save(any(IntegrationExport.class))).thenAnswer(inv -> {
            IntegrationExport e = inv.getArgument(0);
            setField(e, "id", UUID.randomUUID());
            return e;
        });

        exportService.triggerAutoExport(offerId);

        verify(exportRepository, times(TargetSystem.values().length)).save(any());
    }

    @Test
    void triggerAutoExport_shouldSkipAlreadySuccessful() {
        UUID offerId = UUID.randomUUID();

        when(exportRepository.existsByOfferIdAndTargetSystemAndStatus(
                eq(offerId), any(), eq(ExportStatus.SUCCESS))).thenReturn(true);

        exportService.triggerAutoExport(offerId);

        verify(exportRepository, never()).save(any());
    }

    @Test
    void triggerManualExport_shouldCreateExport() {
        UUID offerId = UUID.randomUUID();

        when(exportRepository.save(any(IntegrationExport.class))).thenAnswer(inv -> {
            IntegrationExport e = inv.getArgument(0);
            setField(e, "id", UUID.randomUUID());
            return e;
        });

        IntegrationExportResponse response = exportService.triggerManualExport(
                offerId, TargetSystem.CRM, ExportType.MANUAL_EXPORT);

        assertNotNull(response);
        assertEquals("CRM", response.targetSystem());
        assertEquals("SUCCESS", response.status());
    }

    @Test
    void retryFailedExports_shouldRetryAndMarkSuccess() {
        IntegrationExport failed = new IntegrationExport();
        failed.setOfferId(UUID.randomUUID());
        failed.setTargetSystem(TargetSystem.WEBSITE);
        failed.setExportType(ExportType.AUTO_PUBLISH);
        failed.setStatus(ExportStatus.FAILED);
        failed.setRetryCount(1);
        setField(failed, "id", UUID.randomUUID());

        when(exportRepository.findByStatusAndRetryCountLessThan(ExportStatus.FAILED, 3))
                .thenReturn(List.of(failed));
        when(exportRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));

        exportService.retryFailedExports();

        assertEquals(ExportStatus.SUCCESS, failed.getStatus());
        assertEquals(2, failed.getRetryCount());
        verify(exportRepository).save(failed);
    }

    @Test
    void retryFailedExports_shouldDoNothingIfNoneFailed() {
        when(exportRepository.findByStatusAndRetryCountLessThan(ExportStatus.FAILED, 3))
                .thenReturn(Collections.emptyList());

        exportService.retryFailedExports();

        verify(exportRepository, never()).save(any());
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
