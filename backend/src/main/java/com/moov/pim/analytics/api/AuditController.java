package com.moov.pim.analytics.api;

import com.moov.pim.analytics.api.dto.AuditLogResponse;
import com.moov.pim.analytics.service.AuditService;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

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
    public ResponseEntity<Page<AuditLogResponse>> recent(Pageable pageable) {
        return ResponseEntity.ok(auditService.getRecentLogs(pageable));
    }

    @GetMapping("/entity")
    @PreAuthorize("hasAuthority('AUDIT_VIEW')")
    public ResponseEntity<Page<AuditLogResponse>> entityHistory(@RequestParam String entityType,
                                                                 @RequestParam UUID entityId,
                                                                 Pageable pageable) {
        return ResponseEntity.ok(auditService.getEntityHistory(entityType, entityId, pageable));
    }

    @GetMapping("/user")
    @PreAuthorize("hasAuthority('AUDIT_VIEW')")
    public ResponseEntity<Page<AuditLogResponse>> userHistory(@RequestParam UUID userId, Pageable pageable) {
        return ResponseEntity.ok(auditService.getUserHistory(userId, pageable));
    }
}
