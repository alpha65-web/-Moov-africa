package com.moov.pim.shared.security;

import com.moov.pim.analytics.domain.AuditAction;
import com.moov.pim.analytics.service.AuditService;
import com.moov.pim.permissions.domain.AccountStatus;
import com.moov.pim.permissions.domain.User;
import com.moov.pim.permissions.repository.UserRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.UUID;

@Service
public class DataAnonymizationService {

    private static final Logger log = LoggerFactory.getLogger(DataAnonymizationService.class);

    private final UserRepository userRepository;
    private final AuditService auditService;

    public DataAnonymizationService(UserRepository userRepository, AuditService auditService) {
        this.userRepository = userRepository;
        this.auditService = auditService;
    }

    @Transactional
    public void anonymizeUser(UUID userId, UUID requestedBy) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new IllegalArgumentException("Utilisateur introuvable"));

        String anonymizedTag = "anon_" + UUID.randomUUID().toString().substring(0, 8);

        user.setEmail(anonymizedTag + "@anonymized.local");
        user.setFirstName("Anonymized");
        user.setLastName("User");
        user.setStatus(AccountStatus.DEACTIVATED);
        user.setPasswordHash("$ANONYMIZED$");
        user.setTotpSecret(null);
        user.setTotpEnabled(false);
        user.setFailedLoginAttempts(0);
        user.setAnonymizedAt(java.time.LocalDateTime.now());

        userRepository.save(user);

        auditService.log(
                requestedBy,
                AuditAction.DATA_ANONYMIZED,
                "User",
                userId,
                null,
                "anonymized (RGPD right to erasure)",
                null
        );

        log.info("User {} anonymized by {}", userId, requestedBy);
    }
}
