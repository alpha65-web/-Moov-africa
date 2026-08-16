package com.moov.pim.shared.security;

import com.moov.pim.analytics.api.dto.AuditLogResponse;
import com.moov.pim.analytics.domain.AuditAction;
import com.moov.pim.analytics.repository.AuditLogRepository;
import com.moov.pim.analytics.service.AuditService;
import com.moov.pim.dam.domain.MediaAsset;
import com.moov.pim.dam.repository.MediaAssetRepository;
import com.moov.pim.permissions.api.dto.GdprExportResponse;
import com.moov.pim.permissions.api.dto.GdprExportResponse.MediaAssetData;
import com.moov.pim.permissions.api.dto.GdprExportResponse.UserProfileData;
import com.moov.pim.permissions.domain.User;
import com.moov.pim.permissions.repository.UserRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

@Service
public class GdprExportService {

    private static final Logger log = LoggerFactory.getLogger(GdprExportService.class);

    private final UserRepository userRepository;
    private final AuditLogRepository auditLogRepository;
    private final MediaAssetRepository mediaAssetRepository;
    private final AuditService auditService;

    public GdprExportService(UserRepository userRepository,
                             AuditLogRepository auditLogRepository,
                             MediaAssetRepository mediaAssetRepository,
                             AuditService auditService) {
        this.userRepository = userRepository;
        this.auditLogRepository = auditLogRepository;
        this.mediaAssetRepository = mediaAssetRepository;
        this.auditService = auditService;
    }

    @Transactional(readOnly = true)
    public GdprExportResponse exportUserData(UUID userId, UUID requestedBy) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new IllegalArgumentException("Utilisateur introuvable"));

        UserProfileData profile = new UserProfileData(
                user.getId(),
                user.getEmail(),
                user.getFirstName(),
                user.getLastName(),
                user.getRole().getName().name(),
                user.getStatus().name(),
                user.isTotpEnabled(),
                user.getLastLoginAt(),
                user.getCreatedAt(),
                user.getUpdatedAt()
        );

        List<AuditLogResponse> activityLog = auditLogRepository
                .findByUserIdOrderByCreatedAtDesc(userId)
                .stream()
                .map(AuditLogResponse::from)
                .toList();

        List<MediaAssetData> media = mediaAssetRepository
                .findByUploadedById(userId)
                .stream()
                .map(a -> new MediaAssetData(
                        a.getId(),
                        a.getFileName(),
                        a.getMimeType(),
                        a.getFileSize(),
                        a.getCreatedAt()
                ))
                .toList();

        auditService.log(
                requestedBy,
                AuditAction.DATA_EXPORT_REQUESTED,
                "User",
                userId,
                null,
                "GDPR data export (RGPD Art. 15)",
                null
        );

        log.info("GDPR data export for user {} requested by {}", userId, requestedBy);

        return new GdprExportResponse(
                LocalDateTime.now(),
                "JSON",
                profile,
                activityLog,
                media
        );
    }
}
