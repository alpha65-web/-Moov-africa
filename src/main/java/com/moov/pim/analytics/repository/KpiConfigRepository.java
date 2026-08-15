package com.moov.pim.analytics.repository;

import com.moov.pim.analytics.domain.KpiConfig;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.UUID;

public interface KpiConfigRepository extends JpaRepository<KpiConfig, UUID> {
}
