package com.moov.pim.analytics.service;

import com.moov.pim.analytics.domain.KpiEvent;
import com.moov.pim.analytics.repository.KpiEventRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

@Service
public class KpiService {

    private final KpiEventRepository kpiEventRepository;

    public KpiService(KpiEventRepository kpiEventRepository) {
        this.kpiEventRepository = kpiEventRepository;
    }

    @Transactional
    public KpiEvent record(UUID offerId, String eventType, UUID actorId, Long durationMs) {
        KpiEvent event = new KpiEvent(offerId, eventType, actorId);
        event.setDurationMs(durationMs);
        return kpiEventRepository.save(event);
    }

    @Transactional(readOnly = true)
    public List<KpiEvent> getByOffer(UUID offerId) {
        return kpiEventRepository.findByOfferId(offerId);
    }

    @Transactional(readOnly = true)
    public List<KpiEvent> getByPeriod(LocalDateTime from, LocalDateTime to) {
        return kpiEventRepository.findByPeriod(from, to);
    }
}
