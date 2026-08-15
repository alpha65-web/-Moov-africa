package com.moov.pim.analytics.service;

import com.moov.pim.analytics.api.dto.KpiConfigResponse;
import com.moov.pim.analytics.api.dto.UpdateKpiConfigRequest;
import com.moov.pim.analytics.domain.KpiConfig;
import com.moov.pim.analytics.repository.KpiConfigRepository;
import com.moov.pim.permissions.security.CustomUserDetails;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.UUID;

@Service
public class KpiConfigService {

    private final KpiConfigRepository configRepository;

    public KpiConfigService(KpiConfigRepository configRepository) {
        this.configRepository = configRepository;
    }

    @Transactional(readOnly = true)
    public List<KpiConfigResponse> listAll() {
        return configRepository.findAll().stream()
                .map(KpiConfigResponse::from)
                .toList();
    }

    @Transactional
    public KpiConfigResponse update(UUID id, UpdateKpiConfigRequest request) {
        KpiConfig config = configRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Configuration KPI introuvable"));
        if (request.label() != null) {
            config.setLabel(request.label());
        }
        config.setEnabled(request.enabled());
        if (request.thresholdExpression() != null) {
            config.setThresholdExpression(request.thresholdExpression());
        }
        config.setUpdatedById(currentUserId());
        config = configRepository.save(config);
        return KpiConfigResponse.from(config);
    }

    private UUID currentUserId() {
        CustomUserDetails principal = (CustomUserDetails) SecurityContextHolder
                .getContext().getAuthentication().getPrincipal();
        return principal.getUserId();
    }
}
