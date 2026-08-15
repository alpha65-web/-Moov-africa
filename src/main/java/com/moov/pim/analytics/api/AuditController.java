package com.moov.pim.analytics.api;

import com.moov.pim.analytics.domain.AuditLog;
import com.moov.pim.analytics.service.AuditService;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/audit")
public class AuditController {

    private final AuditService auditService;

    public AuditController(AuditService auditService) {
        this.auditService = auditService;
    }

    @GetMapping
    @PreAuthorize("hasAuthority('AUDIT_VIEW')")
    public ResponseEntity<List<AuditLog>> recent() {
        return ResponseEntity.ok(auditService.getRecentLogs());
    }

    @GetMapping("/entity")
    @PreAuthorize("hasAuthority('AUDIT_VIEW')")
    public ResponseEntity<List<AuditLog>> entityHistory(@RequestParam String entityType,
                                                        @RequestParam UUID entityId) {
        return ResponseEntity.ok(auditService.getEntityHistory(entityType, entityId));
    }

    @GetMapping("/user")
    @PreAuthorize("hasAuthority('AUDIT_VIEW')")
    public ResponseEntity<List<AuditLog>> userHistory(@RequestParam UUID userId) {
        return ResponseEntity.ok(auditService.getUserHistory(userId));
    }
}
