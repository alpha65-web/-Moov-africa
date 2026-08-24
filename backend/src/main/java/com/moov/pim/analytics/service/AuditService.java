package com.moov.pim.analytics.service;

import com.moov.pim.analytics.api.dto.AuditLogResponse;
import com.moov.pim.analytics.domain.AuditAction;
import com.moov.pim.analytics.domain.AuditLog;
import com.moov.pim.analytics.repository.AuditLogRepository;
import com.fasterxml.jackson.core.JacksonException;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.UUID;

@Service
public class AuditService {

    private static final ObjectMapper MAPPER = new ObjectMapper();

    private final AuditLogRepository auditLogRepository;

    public AuditService(AuditLogRepository auditLogRepository) {
        this.auditLogRepository = auditLogRepository;
    }

    /**
     * Rend une valeur ecrivable dans previous_value et new_value.
     *
     * Ces deux colonnes sont de type jsonb, et l'entite les declare
     * {@code @JdbcTypeCode(SqlTypes.JSON)}. Or les sept ecouteurs d'evenements y
     * passaient une chaine brute : un nom d'offre, un statut, une adresse e-mail.
     * PostgreSQL refusait l'insertion avec l'erreur 22P02, et comme les ecouteurs
     * sont asynchrones l'exception n'interrompait rien : la connexion aboutissait,
     * l'archivage aussi, mais aucune trace n'etait ecrite. Le journal d'audit ne
     * contenait donc que ses donnees de demonstration, ce qui n'apparaissait pas a
     * l'ecran puisqu'il n'y avait pas d'erreur visible.
     *
     * Une valeur deja au format JSON est conservee telle quelle — les instantanes
     * d'offre en dependent. Toute autre valeur est encodee en chaine JSON.
     */
    private static String toJson(String value) {
        if (value == null || value.isBlank()) {
            return null;
        }
        try {
            MAPPER.readTree(value);
            return value;
        } catch (JacksonException notJson) {
            try {
                return MAPPER.writeValueAsString(value);
            } catch (JacksonException impossible) {
                return null;
            }
        }
    }

    @Transactional
    public AuditLog log(UUID userId, AuditAction action, String entityType, UUID entityId,
                        String previousValue, String newValue, String ipAddress, String userAgent) {
        AuditLog entry = new AuditLog(userId, action, entityType, entityId);
        entry.setPreviousValue(toJson(previousValue));
        entry.setNewValue(toJson(newValue));
        entry.setIpAddress(ipAddress);
        entry.setUserAgent(userAgent);
        return auditLogRepository.save(entry);
    }

    @Transactional
    public AuditLog log(UUID userId, AuditAction action, String entityType, UUID entityId,
                        String previousValue, String newValue, String ipAddress) {
        return log(userId, action, entityType, entityId, previousValue, newValue, ipAddress, null);
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
