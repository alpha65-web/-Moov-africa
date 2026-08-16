package com.moov.pim.shared.scheduler;

import com.moov.pim.permissions.repository.RefreshTokenRepository;
import com.moov.pim.shared.repository.IdempotencyKeyRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;

@Component
public class DataCleanupScheduler {

    private static final Logger log = LoggerFactory.getLogger(DataCleanupScheduler.class);

    private final IdempotencyKeyRepository idempotencyKeyRepository;
    private final RefreshTokenRepository refreshTokenRepository;

    public DataCleanupScheduler(IdempotencyKeyRepository idempotencyKeyRepository,
                                RefreshTokenRepository refreshTokenRepository) {
        this.idempotencyKeyRepository = idempotencyKeyRepository;
        this.refreshTokenRepository = refreshTokenRepository;
    }

    @Scheduled(fixedRate = 3600000)
    @Transactional
    public void purgeExpiredIdempotencyKeys() {
        int deleted = idempotencyKeyRepository.deleteExpired(LocalDateTime.now());
        if (deleted > 0) {
            log.info("Purged {} expired idempotency keys", deleted);
        }
    }

    @Scheduled(fixedRate = 3600000)
    @Transactional
    public void purgeExpiredRefreshTokens() {
        refreshTokenRepository.deleteExpired(LocalDateTime.now());
        log.debug("Purged expired refresh tokens");
    }
}
