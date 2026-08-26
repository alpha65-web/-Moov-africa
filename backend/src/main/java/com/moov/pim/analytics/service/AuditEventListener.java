package com.moov.pim.analytics.service;

import com.moov.pim.analytics.domain.AuditAction;
import com.moov.pim.shared.event.CatalogItemArchivedEvent;
import com.moov.pim.shared.event.CatalogItemCreatedEvent;
import com.moov.pim.shared.event.LoginFailedEvent;
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
                null, event.email(), event.ipAddress(), event.userAgent());
    }

    /**
     * Journalise une tentative de connexion echouee.
     *
     * L'identifiant du compte est nul lorsque l'adresse saisie ne correspond a
     * aucun utilisateur. Le code ecrivait alors l'UUID nul en guise d'identifiant
     * d'entite pour contourner une contrainte NOT NULL — un identifiant qui ne
     * designe rien et qui se serait retrouve dans les exports d'audit comme une
     * vraie reference. La contrainte a ete relachee (migration V043) : l'absence
     * d'auteur et d'objet est desormais representee par ce qu'elle est, un nul.
     *
     * L'adresse saisie, elle, est toujours conservee : c'est la seule donnee qui
     * permette de reperer une serie d'echecs sur des adresses inconnues.
     */
    @ApplicationModuleListener
    public void on(LoginFailedEvent event) {
        auditService.log(event.userId(), AuditAction.LOGIN_FAILED, "User",
                event.userId(),
                null, event.email(), event.ipAddress(), event.userAgent());
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
