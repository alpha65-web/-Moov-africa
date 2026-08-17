package com.moov.pim.notification.service;

import com.moov.pim.notification.domain.NotificationType;
import com.moov.pim.shared.event.OfferTransitionEvent;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.UUID;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class NotificationEventListenerTest {

    @Mock private NotificationService notificationService;
    @InjectMocks private NotificationEventListener listener;

    @Test
    void onOfferTransition_shouldSendNotificationForPublished() {
        UUID offerId = UUID.randomUUID();
        UUID userId = UUID.randomUUID();
        var event = new OfferTransitionEvent(offerId, "Mon Offre", userId, "VALIDATED", "PUBLISHED");

        listener.on(event);

        verify(notificationService).send(
                eq(userId), eq(NotificationType.OFFER_PUBLISHED),
                eq("Offre publiée"), any(String.class), eq(offerId));
    }

    @Test
    void onOfferTransition_shouldSendNotificationForValidationRequired() {
        UUID offerId = UUID.randomUUID();
        UUID userId = UUID.randomUUID();
        var event = new OfferTransitionEvent(offerId, "Offre X", userId, "IN_ENRICHMENT", "IN_VALIDATION");

        listener.on(event);

        verify(notificationService).send(
                eq(userId), eq(NotificationType.VALIDATION_REQUIRED),
                eq("Validation requise"), any(String.class), eq(offerId));
    }

    @Test
    void onOfferTransition_shouldNotSendForUnmappedStatus() {
        UUID offerId = UUID.randomUUID();
        UUID userId = UUID.randomUUID();
        var event = new OfferTransitionEvent(offerId, "Offre Y", userId, "DRAFT", "UNKNOWN");

        listener.on(event);

        verifyNoInteractions(notificationService);
    }

    @Test
    void onOfferTransition_shouldSendForRejected() {
        UUID offerId = UUID.randomUUID();
        UUID userId = UUID.randomUUID();
        var event = new OfferTransitionEvent(offerId, "Offre Z", userId, "IN_VALIDATION", "WITHDRAWN");

        listener.on(event);

        verify(notificationService).send(
                eq(userId), eq(NotificationType.OFFER_REJECTED),
                eq("Offre rejetée"), any(String.class), eq(offerId));
    }
}
