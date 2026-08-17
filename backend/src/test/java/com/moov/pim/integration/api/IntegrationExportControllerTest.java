package com.moov.pim.integration.api;

import com.moov.pim.integration.api.dto.IntegrationExportResponse;
import com.moov.pim.integration.domain.ExportStatus;
import com.moov.pim.integration.domain.ExportType;
import com.moov.pim.integration.domain.TargetSystem;
import com.moov.pim.integration.service.IntegrationExportService;
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
class IntegrationExportControllerTest {

    @Mock private IntegrationExportService exportService;
    @InjectMocks private IntegrationExportController controller;

    @Test
    void trigger_shouldReturn201() {
        UUID offerId = UUID.randomUUID();
        var response = mock(IntegrationExportResponse.class);
        when(exportService.triggerManualExport(offerId, TargetSystem.CRM, ExportType.MANUAL_EXPORT))
                .thenReturn(response);

        var result = controller.trigger(offerId, TargetSystem.CRM, ExportType.MANUAL_EXPORT);

        assertEquals(HttpStatus.CREATED, result.getStatusCode());
        assertEquals(response, result.getBody());
    }

    @Test
    void byOffer_shouldReturn200() {
        UUID offerId = UUID.randomUUID();
        var pageable = PageRequest.of(0, 10);
        when(exportService.listByOffer(offerId, pageable))
                .thenReturn(new PageImpl<>(List.of()));

        var result = controller.byOffer(offerId, pageable);

        assertEquals(HttpStatus.OK, result.getStatusCode());
    }

    @Test
    void byStatus_shouldReturn200() {
        var pageable = PageRequest.of(0, 10);
        when(exportService.listByStatus(ExportStatus.PENDING, pageable))
                .thenReturn(new PageImpl<>(List.of()));

        var result = controller.byStatus(ExportStatus.PENDING, pageable);

        assertEquals(HttpStatus.OK, result.getStatusCode());
    }
}
