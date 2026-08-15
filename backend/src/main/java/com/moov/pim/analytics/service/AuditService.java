package com.moov.pim.analytics.service;

import com.moov.pim.analytics.api.dto.AuditLogResponse;
import com.moov.pim.analytics.domain.AuditAction;
import com.moov.pim.analytics.domain.AuditLog;
import com.moov.pim.analytics.repository.AuditLogRepository;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.UUID;

@Service
public class AuditService {

    private final AuditLogRepository auditLogRepository;

    public AuditService(AuditLogRepository auditLogRepository) {
        this.auditLogRepository = auditLogRepository;
    }

    @Transactional
    public AuditLog log(UUID userId, AuditAction action, String entityType, UUID entityId,
                        String previousValue, String newValue, String ipAddress) {
        AuditLog entry = new AuditLog(userId, action, entityType, entityId);
        entry.setPreviousValue(previousValue);
        entry.setNewValue(newValue);
        entry.setIpAddress(ipAddress);
        return auditLogRepository.save(entry);
    }

    @Transactional(readOnly = true)
    public Page<AuditLogResponse> getRecentLogs(Pageable pageable) {
        return auditLogRepository.findAllByOrderByCreatedAtDesc(pageable).map(AuditLogResponse::from);
    }

    @Transactional(readOnly = true)
    public Page<AuditLogResponse> getEntityHistory(String entityType, UUID entityId, Pageable pageable) {
        return auditLogRepository.findByEntityTypeAndEntityIdOrderByCreatedAtDesc(entityType, entityId, pageable)
                .map(AuditLogResponse::from);
    }

    @Transactional(readOnly = true)
    public Page<AuditLogResponse> getUserHistory(UUID userId, Pageable pageable) {
        return auditLogRepository.findByUserIdOrderByCreatedAtDesc(userId, pageable).map(AuditLogResponse::from);
    }
}
