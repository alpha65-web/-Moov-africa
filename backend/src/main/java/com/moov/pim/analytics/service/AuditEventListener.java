package com.moov.pim.analytics.service;

import com.moov.pim.analytics.domain.AuditAction;
import com.moov.pim.shared.event.CatalogItemArchivedEvent;
import com.moov.pim.shared.event.CatalogItemCreatedEvent;
import com.moov.pim.shared.event.OfferCreatedEvent;
import com.moov.pim.shared.event.OfferTransitionEvent;
import com.moov.pim.shared.event.UserLoginEvent;
import com.moov.pim.shared.event.UserRegisteredEvent;
import org.springframework.modulith.events.ApplicationModuleListener;
import org.springframework.stereotype.Component;

@Component
public class AuditEventListener {

    private final AuditService auditService;

    public AuditEventListener(AuditService auditService) {
        this.auditService = auditService;
    }

    @ApplicationModuleListener
    public void on(OfferCreatedEvent event) {
        auditService.log(event.userId(), AuditAction.CREATE, "Offer", event.offerId(),
                null, event.offerName(), null);
    }

    @ApplicationModuleListener
    public void on(OfferTransitionEvent event) {
        AuditAction action = mapTransitionAction(event.toStatus());
        auditService.log(event.userId(), action, "Offer", event.offerId(),
                event.fromStatus(), event.toStatus(), null);
    }

    @ApplicationModuleListener
    public void on(CatalogItemCreatedEvent event) {
        auditService.log(event.userId(), AuditAction.CREATE, event.itemType(), event.itemId(),
                null, event.itemName(), null);
    }

    @ApplicationModuleListener
    public void on(CatalogItemArchivedEvent event) {
        auditService.log(event.userId(), AuditAction.DELETE, "CatalogItem", event.itemId(),
                "ACTIVE", "ARCHIVED", null);
    }

    @ApplicationModuleListener
    public void on(UserLoginEvent event) {
        auditService.log(event.userId(), AuditAction.LOGIN, "User", event.userId(),
                null, event.email(), null);
    }

    @ApplicationModuleListener
    public void on(UserRegisteredEvent event) {
        auditService.log(event.userId(), AuditAction.CREATE, "User", event.userId(),
                null, event.email(), null);
    }

    private AuditAction mapTransitionAction(String toStatus) {
        return switch (toStatus) {
            case "PUBLISHED" -> AuditAction.PUBLISH;
            case "IN_VALIDATION", "VALIDATED" -> AuditAction.VALIDATE;
            case "WITHDRAWN", "SUSPENDED" -> AuditAction.REJECT;
            default -> AuditAction.UPDATE;
        };
    }
}
