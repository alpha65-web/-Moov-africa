package com.moov.pim.shared.repository;

import com.moov.pim.shared.domain.PlatformSettings;
import org.springframework.data.jpa.repository.JpaRepository;

public interface PlatformSettingsRepository extends JpaRepository<PlatformSettings, Integer> {
}
