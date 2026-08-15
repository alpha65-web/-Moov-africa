package com.moov.pim.integration.api;

import com.moov.pim.integration.api.dto.IntegrationExportResponse;
import com.moov.pim.integration.domain.ExportStatus;
import com.moov.pim.integration.domain.ExportType;
import com.moov.pim.integration.domain.TargetSystem;
import com.moov.pim.integration.service.IntegrationExportService;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.UUID;

@RestController
@RequestMapping("/exports")
public class IntegrationExportController {

    private final IntegrationExportService exportService;

    public IntegrationExportController(IntegrationExportService exportService) {
        this.exportService = exportService;
    }

    @PostMapping("/trigger")
    @PreAuthorize("hasRole('ADMIN_SYSTEME')")
    public ResponseEntity<IntegrationExportResponse> trigger(
            @RequestParam UUID offerId,
            @RequestParam TargetSystem targetSystem,
            @RequestParam(defaultValue = "MANUAL_EXPORT") ExportType exportType) {
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(exportService.triggerManualExport(offerId, targetSystem, exportType));
    }

    @GetMapping("/offers/{offerId}")
    @PreAuthorize("hasAuthority('CATALOG_READ')")
    public ResponseEntity<Page<IntegrationExportResponse>> byOffer(@PathVariable UUID offerId, Pageable pageable) {
        return ResponseEntity.ok(exportService.listByOffer(offerId, pageable));
    }

    @GetMapping
    @PreAuthorize("hasRole('ADMIN_SYSTEME')")
    public ResponseEntity<Page<IntegrationExportResponse>> byStatus(
            @RequestParam(defaultValue = "PENDING") ExportStatus status, Pageable pageable) {
        return ResponseEntity.ok(exportService.listByStatus(status, pageable));
    }
}
