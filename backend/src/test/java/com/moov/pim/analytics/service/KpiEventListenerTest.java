package com.moov.pim.analytics.service;

import com.moov.pim.shared.event.OfferCreatedEvent;
import com.moov.pim.shared.event.OfferTransitionEvent;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.UUID;

import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class KpiEventListenerTest {

    @Mock private KpiService kpiService;
    @InjectMocks private KpiEventListener listener;

    @Test
    void onOfferCreated_shouldRecordKpi() {
        UUID offerId = UUID.randomUUID();
        UUID userId = UUID.randomUUID();
        var event = new OfferCreatedEvent(offerId, "Offre Test", userId);

        listener.on(event);

        verify(kpiService).record(offerId, "OFFER_CREATED", userId, null);
    }

    @Test
    void onOfferTransition_shouldRecordWithStatus() {
        UUID offerId = UUID.randomUUID();
        UUID userId = UUID.randomUUID();
        var event = new OfferTransitionEvent(offerId, "Offre", userId, "DRAFT", "PUBLISHED");

        listener.on(event);

        verify(kpiService).record(offerId, "STATUS_PUBLISHED", userId, null);
    }
}
