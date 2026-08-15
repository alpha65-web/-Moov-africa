package com.moov.pim.notification.repository;

import com.moov.pim.notification.domain.NotificationConfig;
import com.moov.pim.notification.domain.NotificationType;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.UUID;

public interface NotificationConfigRepository extends JpaRepository<NotificationConfig, UUID> {

    List<NotificationConfig> findByTypeAndEnabledTrue(NotificationType type);
}
