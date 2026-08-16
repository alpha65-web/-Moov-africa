package com.moov.pim.permissions.api;

import com.moov.pim.permissions.api.dto.GdprExportResponse;
import com.moov.pim.permissions.security.CustomUserDetails;
import com.moov.pim.shared.security.DataAnonymizationService;
import com.moov.pim.shared.security.GdprExportService;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.UUID;

@RestController
@RequestMapping("/gdpr")
public class GdprController {

    private final DataAnonymizationService anonymizationService;
    private final GdprExportService gdprExportService;

    public GdprController(DataAnonymizationService anonymizationService,
                          GdprExportService gdprExportService) {
        this.anonymizationService = anonymizationService;
        this.gdprExportService = gdprExportService;
    }

    @GetMapping("/users/{userId}/export")
    @PreAuthorize("hasAuthority('USER_MANAGE') or #userId == authentication.principal.userId")
    public ResponseEntity<GdprExportResponse> exportUserData(
            @PathVariable UUID userId,
            @AuthenticationPrincipal CustomUserDetails principal) {
        GdprExportResponse export = gdprExportService.exportUserData(userId, principal.getUserId());
        return ResponseEntity.ok(export);
    }

    @DeleteMapping("/users/{userId}/anonymize")
    @PreAuthorize("hasAuthority('USER_MANAGE')")
    public ResponseEntity<Void> anonymizeUser(@PathVariable UUID userId,
                                               @AuthenticationPrincipal CustomUserDetails principal) {
        anonymizationService.anonymizeUser(userId, principal.getUserId());
        return ResponseEntity.noContent().build();
    }
}
