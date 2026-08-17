package com.moov.pim.analytics.service;

import com.moov.pim.analytics.domain.AuditAction;
import com.moov.pim.shared.event.CatalogItemArchivedEvent;
import com.moov.pim.shared.event.CatalogItemCreatedEvent;
import com.moov.pim.shared.event.LoginFailedEvent;
import com.moov.pim.shared.event.OfferCreatedEvent;
import com.moov.pim.shared.event.OfferTransitionEvent;
import com.moov.pim.shared.event.UserLoginEvent;
import com.moov.pim.shared.event.UserRegisteredEvent;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.UUID;

import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class AuditEventListenerTest {

    @Mock private AuditService auditService;
    @InjectMocks private AuditEventListener listener;

    @Test
    void onOfferCreated_shouldLogCreate() {
        UUID offerId = UUID.randomUUID();
        UUID userId = UUID.randomUUID();
        var event = new OfferCreatedEvent(offerId, "Offre A", userId);

        listener.on(event);

        verify(auditService).log(userId, AuditAction.CREATE, "Offer", offerId,
                null, "Offre A", null);
    }

    @Test
    void onOfferTransition_shouldLogPublish() {
        UUID offerId = UUID.randomUUID();
        UUID userId = UUID.randomUUID();
        var event = new OfferTransitionEvent(offerId, "Offre B", userId, "VALIDATED", "PUBLISHED");

        listener.on(event);

        verify(auditService).log(userId, AuditAction.PUBLISH, "Offer", offerId,
                "VALIDATED", "PUBLISHED", null);
    }

    @Test
    void onOfferTransition_shouldLogRejectForWithdrawn() {
        UUID offerId = UUID.randomUUID();
        UUID userId = UUID.randomUUID();
        var event = new OfferTransitionEvent(offerId, "Offre C", userId, "IN_VALIDATION", "WITHDRAWN");

        listener.on(event);

        verify(auditService).log(userId, AuditAction.REJECT, "Offer", offerId,
                "IN_VALIDATION", "WITHDRAWN", null);
    }

    @Test
    void onCatalogItemCreated_shouldLogCreate() {
        UUID itemId = UUID.randomUUID();
        UUID userId = UUID.randomUUID();
        var event = new CatalogItemCreatedEvent(itemId, "Produit X", "Product", userId);

        listener.on(event);

        verify(auditService).log(userId, AuditAction.CREATE, "Product", itemId,
                null, "Produit X", null);
    }

    @Test
    void onCatalogItemArchived_shouldLogDelete() {
        UUID itemId = UUID.randomUUID();
        UUID userId = UUID.randomUUID();
        var event = new CatalogItemArchivedEvent(itemId, userId);

        listener.on(event);

        verify(auditService).log(userId, AuditAction.DELETE, "CatalogItem", itemId,
                "ACTIVE", "ARCHIVED", null);
    }

    @Test
    void onUserLogin_shouldLogLogin() {
        UUID userId = UUID.randomUUID();
        var event = new UserLoginEvent(userId, "user@moov.bf", "192.168.1.1", "Mozilla/5.0");

        listener.on(event);

        verify(auditService).log(userId, AuditAction.LOGIN, "User", userId,
                null, "user@moov.bf", "192.168.1.1", "Mozilla/5.0");
    }

    @Test
    void onLoginFailed_shouldLogLoginFailed() {
        UUID userId = UUID.randomUUID();
        var event = new LoginFailedEvent(userId, "user@moov.bf", "bad password", "10.0.0.1", "curl");

        listener.on(event);

        verify(auditService).log(userId, AuditAction.LOGIN_FAILED, "User", userId,
                null, "user@moov.bf", "10.0.0.1", "curl");
    }

    @Test
    void onUserRegistered_shouldLogCreate() {
        UUID userId = UUID.randomUUID();
        var event = new UserRegisteredEvent(userId, "new@moov.bf");

        listener.on(event);

        verify(auditService).log(userId, AuditAction.CREATE, "User", userId,
                null, "new@moov.bf", null);
    }
}
