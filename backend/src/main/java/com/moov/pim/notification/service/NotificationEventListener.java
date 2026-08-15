package com.moov.pim.notification.service;

import com.moov.pim.notification.domain.NotificationType;
import com.moov.pim.shared.event.OfferTransitionEvent;
import org.springframework.modulith.events.ApplicationModuleListener;
import org.springframework.stereotype.Component;

@Component
public class NotificationEventListener {

    private final NotificationService notificationService;

    public NotificationEventListener(NotificationService notificationService) {
        this.notificationService = notificationService;
    }

    @ApplicationModuleListener
    public void on(OfferTransitionEvent event) {
        NotificationType type = mapType(event.toStatus());
        if (type == null) return;

        String title = switch (type) {
            case ENRICHMENT_REQUIRED -> "Enrichissement requis";
            case VALIDATION_REQUIRED -> "Validation requise";
            case OFFER_PUBLISHED -> "Offre publiée";
            case OFFER_REJECTED -> "Offre rejetée";
            default -> "Changement de statut";
        };

        String message = "L'offre « " + event.offerName() + " » est passée de "
                + event.fromStatus() + " à " + event.toStatus();

        notificationService.send(event.userId(), type, title, message, event.offerId());
    }

    private NotificationType mapType(String toStatus) {
        return switch (toStatus) {
            case "IN_ENRICHMENT" -> NotificationType.ENRICHMENT_REQUIRED;
            case "IN_VALIDATION" -> NotificationType.VALIDATION_REQUIRED;
            case "PUBLISHED" -> NotificationType.OFFER_PUBLISHED;
            case "WITHDRAWN", "SUSPENDED" -> NotificationType.OFFER_REJECTED;
            default -> null;
        };
    }
}
