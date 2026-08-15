package com.moov.pim.notification.service;

import com.moov.pim.notification.api.dto.NotificationConfigResponse;
import com.moov.pim.notification.api.dto.UpdateNotificationConfigRequest;
import com.moov.pim.notification.domain.NotificationConfig;
import com.moov.pim.notification.repository.NotificationConfigRepository;
import com.moov.pim.permissions.security.CustomUserDetails;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.UUID;

@Service
public class NotificationConfigService {

    private final NotificationConfigRepository configRepository;

    public NotificationConfigService(NotificationConfigRepository configRepository) {
        this.configRepository = configRepository;
    }

    @Transactional(readOnly = true)
    public List<NotificationConfigResponse> listAll() {
        return configRepository.findAll().stream()
                .map(NotificationConfigResponse::from)
                .toList();
    }

    @Transactional
    public NotificationConfigResponse update(UUID id, UpdateNotificationConfigRequest request) {
        NotificationConfig config = configRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Configuration de notification introuvable"));
        config.setEnabled(request.enabled());
        if (request.channel() != null) {
            config.setChannel(request.channel());
        }
        config.setUpdatedById(currentUserId());
        config = configRepository.save(config);
        return NotificationConfigResponse.from(config);
    }

    private UUID currentUserId() {
        CustomUserDetails principal = (CustomUserDetails) SecurityContextHolder
                .getContext().getAuthentication().getPrincipal();
        return principal.getUserId();
    }
}
