package com.moov.pim.notification.service;

import com.moov.pim.notification.api.dto.NotificationResponse;
import com.moov.pim.notification.domain.Notification;
import com.moov.pim.notification.domain.NotificationType;
import com.moov.pim.shared.event.*;
import org.springframework.modulith.events.ApplicationModuleListener;
import org.springframework.stereotype.Component;

import java.util.List;
import java.util.UUID;

@Component
public class NotificationEventListener {

    private final NotificationService notificationService;
    private final NotificationRouter router;
    private final SseService sseService;

    public NotificationEventListener(NotificationService notificationService,
                                     NotificationRouter router,
                                     SseService sseService) {
        this.notificationService = notificationService;
        this.router = router;
        this.sseService = sseService;
    }

    @ApplicationModuleListener
    public void on(OfferTransitionEvent event) {
        NotificationType type = mapOfferTransitionType(event.toStatus());
        if (type == null) return;

        String title = switch (type) {
            case ENRICHMENT_REQUIRED -> "Enrichissement requis";
            case VALIDATION_REQUIRED -> "Validation requise";
            case STRATEGIC_VALIDATION -> "Validation strategique requise";
            case OFFER_PUBLISHED -> "Offre publiee";
            case OFFER_REJECTED -> "Offre rejetee";
            default -> "Changement de statut";
        };

        String message = "L'offre « " + event.offerName() + " » est passee de "
                + event.fromStatus() + " a " + event.toStatus();

        broadcast(type, title, message, event.userId(), event.offerId());
    }

    @ApplicationModuleListener
    public void on(OfferCreatedEvent event) {
        broadcast(
                NotificationType.OFFER_CREATED,
                "Nouvelle offre creee",
                "L'offre « " + event.offerName() + " » a ete creee",
                event.userId(),
                event.offerId()
        );
    }

    @ApplicationModuleListener
    public void on(MediaValidatedEvent event) {
        NotificationType type = event.approved()
                ? NotificationType.MEDIA_VALIDATED
                : NotificationType.MEDIA_REJECTED;
        String title = event.approved() ? "Media valide" : "Media rejete";
        String message = "Le fichier « " + event.fileName() + " » a ete "
                + (event.approved() ? "approuve" : "rejete");

        broadcast(type, title, message, event.validatedById(), null);
    }

    @ApplicationModuleListener
    public void on(CampaignStatusEvent event) {
        NotificationType type = switch (event.status()) {
            case "PUBLISHED" -> NotificationType.CAMPAIGN_PUBLISHED;
            case "CANCELLED" -> NotificationType.CAMPAIGN_CANCELLED;
            default -> NotificationType.CAMPAIGN_READY;
        };
        String title = switch (event.status()) {
            case "PUBLISHED" -> "Campagne publiee";
            case "CANCELLED" -> "Campagne annulee";
            default -> "Campagne prete";
        };
        String message = "La campagne « " + event.campaignName() + " » : " + event.status();

        broadcast(type, title, message, event.userId(), null);
    }

    @ApplicationModuleListener
    public void on(AiTaskCompletedEvent event) {
        NotificationType type = event.success()
                ? NotificationType.AI_TASK_COMPLETED
                : NotificationType.AI_TASK_FAILED;
        String title = event.success() ? "Tache IA terminee" : "Echec tache IA";
        String message = "Tache " + event.task()
                + (event.entityName() != null ? " sur « " + event.entityName() + " »" : "")
                + (event.success() ? " terminee avec succes" : " a echoue");

        broadcast(type, title, message, event.userId(), null);
    }

    @ApplicationModuleListener
    public void on(CatalogItemCreatedEvent event) {
        broadcast(
                NotificationType.CATALOG_ITEM_CREATED,
                "Nouvel element catalogue",
                "L'element « " + event.itemName() + " » (" + event.itemType() + ") a ete cree",
                event.userId(),
                null
        );
    }

    @ApplicationModuleListener
    public void on(CatalogItemArchivedEvent event) {
        broadcast(
                NotificationType.CATALOG_ITEM_ARCHIVED,
                "Element catalogue archive",
                "Un element du catalogue a ete archive",
                event.userId(),
                null
        );
    }

    @ApplicationModuleListener
    public void on(UserRegisteredEvent event) {
        broadcast(
                NotificationType.USER_REGISTERED,
                "Nouvel utilisateur",
                "Un nouveau compte a ete cree : " + event.email(),
                event.userId(),
                null
        );
    }

    private void broadcast(NotificationType type, String title, String message,
                           UUID triggerUserId, UUID relatedOfferId) {
        List<UUID> recipients = router.resolveRecipients(type, triggerUserId);

        for (UUID recipientId : recipients) {
            Notification saved = notificationService.send(recipientId, type, title, message, relatedOfferId);
            sseService.push(recipientId, NotificationResponse.from(saved));
        }
    }

    private NotificationType mapOfferTransitionType(String toStatus) {
        return switch (toStatus) {
            case "IN_ENRICHMENT" -> NotificationType.ENRICHMENT_REQUIRED;
            case "IN_VALIDATION" -> NotificationType.VALIDATION_REQUIRED;
            case "IN_STRATEGIC_VALIDATION" -> NotificationType.STRATEGIC_VALIDATION;
            case "PUBLISHED" -> NotificationType.OFFER_PUBLISHED;
            case "WITHDRAWN", "SUSPENDED" -> NotificationType.OFFER_REJECTED;
            default -> null;
        };
    }
}
