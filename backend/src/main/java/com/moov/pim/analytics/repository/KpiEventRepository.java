package com.moov.pim.analytics.repository;

import com.moov.pim.analytics.domain.KpiEvent;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

public interface KpiEventRepository extends JpaRepository<KpiEvent, UUID> {

    List<KpiEvent> findByOfferId(UUID offerId);

    Page<KpiEvent> findByOfferId(UUID offerId, Pageable pageable);

    List<KpiEvent> findByEventType(String eventType);

    @Query("SELECT k FROM KpiEvent k WHERE k.createdAt >= :from AND k.createdAt <= :to ORDER BY k.createdAt DESC")
    List<KpiEvent> findByPeriod(LocalDateTime from, LocalDateTime to);

    @Query("SELECT k FROM KpiEvent k WHERE k.createdAt >= :from AND k.createdAt <= :to ORDER BY k.createdAt DESC")
    Page<KpiEvent> findByPeriod(LocalDateTime from, LocalDateTime to, Pageable pageable);
}
