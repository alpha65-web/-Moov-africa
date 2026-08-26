package com.moov.pim.integration.api;

import com.moov.pim.integration.api.dto.IntegrationExportResponse;
import com.moov.pim.integration.api.dto.OfferDiffusionRow;
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

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/exports")
public class IntegrationExportController {

    private final IntegrationExportService exportService;

    public IntegrationExportController(IntegrationExportService exportService) {
        this.exportService = exportService;
    }

    @PostMapping("/trigger")
    @PreAuthorize("hasAuthority('EXPORT_MANAGE')")
    public ResponseEntity<IntegrationExportResponse> trigger(
            @RequestParam UUID offerId,
            @RequestParam TargetSystem targetSystem,
            @RequestParam(defaultValue = "MANUAL_EXPORT") ExportType exportType) {
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(exportService.triggerManualExport(offerId, targetSystem, exportType));
    }

    /**
     * Rapprochement entre les offres publiees et leur diffusion effective.
     *
     * Protege par ANALYTICS_TEAM_VIEW et non par EXPORT_MANAGE : le cahier des
     * charges (l. 106) confie ce rapprochement au chef de departement, qui publie
     * les offres, alors que EXPORT_MANAGE commande le declenchement des exports et
     * l export autonome du catalogue, reserves a l administration (7.11). Ouvrir la
     * seconde pour obtenir la premiere aurait donne au chef de departement des
     * commandes qui ne relevent pas de son role.
     */
    @GetMapping("/reconciliation")
    @PreAuthorize("hasAuthority('ANALYTICS_TEAM_VIEW')")
    public ResponseEntity<List<OfferDiffusionRow>> reconciliation() {
        return ResponseEntity.ok(exportService.reconciliation());
    }

    @GetMapping("/offers/{offerId}")
    @PreAuthorize("hasAuthority('CATALOG_READ')")
    public ResponseEntity<Page<IntegrationExportResponse>> byOffer(@PathVariable UUID offerId, Pageable pageable) {
        return ResponseEntity.ok(exportService.listByOffer(offerId, pageable));
    }

    // status omis => tous les exports. Sans cela, l'ecran ne pouvait afficher que
    // les exports PENDING et les exports termines restaient invisibles.
    @GetMapping
    @PreAuthorize("hasAuthority('EXPORT_MANAGE')")
    public ResponseEntity<Page<IntegrationExportResponse>> list(
            @RequestParam(required = false) ExportStatus status, Pageable pageable) {
        return ResponseEntity.ok(status == null
                ? exportService.listAll(pageable)
                : exportService.listByStatus(status, pageable));
    }
}
