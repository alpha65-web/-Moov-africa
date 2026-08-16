package com.moov.pim.permissions.service;

import com.moov.pim.permissions.repository.RefreshTokenRepository;
import com.moov.pim.permissions.repository.UserRepository;
import com.moov.pim.shared.logging.SecurityMetricsService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.time.temporal.ChronoUnit;

@Service
public class KeyManagementService {

    private static final Logger log = LoggerFactory.getLogger(KeyManagementService.class);

    private final UserRepository userRepository;
    private final RefreshTokenRepository refreshTokenRepository;
    private final SecurityMetricsService metricsService;

    @Value("${pim.key-rotation.session-key-max-age-days:90}")
    private int sessionKeyMaxAgeDays;

    @Value("${pim.key-rotation.master-key-max-age-days:365}")
    private int masterKeyMaxAgeDays;

    private LocalDateTime lastSessionKeyRotation = LocalDateTime.now();
    private LocalDateTime lastMasterKeyRotation = LocalDateTime.now();

    public KeyManagementService(UserRepository userRepository,
                                 RefreshTokenRepository refreshTokenRepository,
                                 SecurityMetricsService metricsService) {
        this.userRepository = userRepository;
        this.refreshTokenRepository = refreshTokenRepository;
        this.metricsService = metricsService;
    }

    @Transactional
    public int emergencyRevokeAllSessions() {
        log.warn("EMERGENCY: Revoking all active sessions and rotating all token versions");
        refreshTokenRepository.revokeAll();
        int updatedUsers = userRepository.incrementAllTokenVersions();
        lastSessionKeyRotation = LocalDateTime.now();
        metricsService.recordAccessDenied();
        log.warn("EMERGENCY: Revoked all sessions for {} users", updatedUsers);
        return updatedUsers;
    }

    @Transactional
    public void rotateSessionKeys() {
        log.info("Rotating session keys: revoking all refresh tokens and incrementing token versions");
        refreshTokenRepository.revokeAll();
        int updatedUsers = userRepository.incrementAllTokenVersions();
        lastSessionKeyRotation = LocalDateTime.now();
        log.info("Session key rotation complete: {} users affected", updatedUsers);
    }

    @Scheduled(cron = "0 0 2 * * MON")
    public void checkKeyRotationCompliance() {
        long sessionKeyAgeDays = ChronoUnit.DAYS.between(lastSessionKeyRotation, LocalDateTime.now());
        long masterKeyAgeDays = ChronoUnit.DAYS.between(lastMasterKeyRotation, LocalDateTime.now());

        if (sessionKeyAgeDays > sessionKeyMaxAgeDays) {
            log.warn("SESSION KEY ROTATION OVERDUE: last rotated {} days ago (policy: {} days)",
                    sessionKeyAgeDays, sessionKeyMaxAgeDays);
        } else if (sessionKeyAgeDays > sessionKeyMaxAgeDays - 14) {
            log.info("Session key rotation due in {} days", sessionKeyMaxAgeDays - sessionKeyAgeDays);
        }

        if (masterKeyAgeDays > masterKeyMaxAgeDays) {
            log.warn("MASTER KEY ROTATION OVERDUE: last rotated {} days ago (policy: {} days)",
                    masterKeyAgeDays, masterKeyMaxAgeDays);
        } else if (masterKeyAgeDays > masterKeyMaxAgeDays - 30) {
            log.info("Master key rotation due in {} days", masterKeyMaxAgeDays - masterKeyAgeDays);
        }
    }

    public LocalDateTime getLastSessionKeyRotation() {
        return lastSessionKeyRotation;
    }

    public LocalDateTime getLastMasterKeyRotation() {
        return lastMasterKeyRotation;
    }

    public void recordMasterKeyRotation() {
        lastMasterKeyRotation = LocalDateTime.now();
        log.info("Master encryption key rotated via Vault");
    }
}
