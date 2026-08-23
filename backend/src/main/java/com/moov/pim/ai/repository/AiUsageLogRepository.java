package com.moov.pim.ai.repository;

import com.moov.pim.ai.domain.AiTask;
import com.moov.pim.ai.domain.AiUsageLog;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

public interface AiUsageLogRepository extends JpaRepository<AiUsageLog, UUID> {

    long countByUserId(UUID userId);

    long countByUserIdAndSuccess(UUID userId, boolean success);

    @Query("SELECT COUNT(l) FROM AiUsageLog l WHERE l.userId = :userId AND l.createdAt >= :since")
    long countByUserIdSince(@Param("userId") UUID userId, @Param("since") LocalDateTime since);

    @Query("SELECT l.task, COUNT(l) FROM AiUsageLog l WHERE l.createdAt >= :since GROUP BY l.task")
    List<Object[]> countByTaskSince(@Param("since") LocalDateTime since);

    @Query("SELECT CAST(l.createdAt AS date), COUNT(l) FROM AiUsageLog l WHERE l.createdAt >= :since GROUP BY CAST(l.createdAt AS date) ORDER BY CAST(l.createdAt AS date)")
    List<Object[]> countByDaySince(@Param("since") LocalDateTime since);

    @Query("SELECT SUM(l.inputTokens) FROM AiUsageLog l WHERE l.createdAt >= :since")
    Long sumInputTokensSince(@Param("since") LocalDateTime since);

    @Query("SELECT SUM(l.outputTokens) FROM AiUsageLog l WHERE l.createdAt >= :since")
    Long sumOutputTokensSince(@Param("since") LocalDateTime since);

    @Query("SELECT AVG(l.latencyMs) FROM AiUsageLog l WHERE l.createdAt >= :since AND l.success = true")
    Double avgLatencyMsSince(@Param("since") LocalDateTime since);

    List<AiUsageLog> findTop20ByUserIdOrderByCreatedAtDesc(UUID userId);
}
