package com.moov.pim.analytics.service;

import com.moov.pim.shared.event.OfferCreatedEvent;
import com.moov.pim.shared.event.OfferTransitionEvent;
import org.springframework.modulith.events.ApplicationModuleListener;
import org.springframework.stereotype.Component;

@Component
public class KpiEventListener {

    private final KpiService kpiService;

    public KpiEventListener(KpiService kpiService) {
        this.kpiService = kpiService;
    }

    @ApplicationModuleListener
    public void on(OfferCreatedEvent event) {
        kpiService.record(event.offerId(), "OFFER_CREATED", event.userId(), null);
    }

    @ApplicationModuleListener
    public void on(OfferTransitionEvent event) {
        kpiService.record(event.offerId(), "STATUS_" + event.toStatus(), event.userId(), null);
    }
}
