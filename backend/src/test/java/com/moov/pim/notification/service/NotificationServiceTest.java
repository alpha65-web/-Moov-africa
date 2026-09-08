package com.moov.pim.notification.service;

import com.moov.pim.notification.domain.Notification;
import com.moov.pim.notification.domain.NotificationConfig;
import com.moov.pim.notification.domain.NotificationType;
import com.moov.pim.notification.repository.NotificationConfigRepository;
import com.moov.pim.notification.repository.NotificationRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.lang.reflect.Field;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class NotificationServiceTest {

    @Mock private NotificationRepository notificationRepository;
    @Mock private NotificationConfigRepository configRepository;

    @InjectMocks private NotificationService notificationService;

    @Test
    void send_shouldCreateNotification() {
        UUID recipientId = UUID.randomUUID();
        UUID offerId = UUID.randomUUID();

        when(notificationRepository.save(any(Notification.class))).thenAnswer(inv -> {
            Notification n = inv.getArgument(0);
            setField(n, "id", UUID.randomUUID());
            return n;
        });

        Notification result = notificationService.send(
                recipientId, NotificationType.OFFER_PUBLISHED, "Offre publiée",
                "Votre offre a été publiée", offerId);

        assertNotNull(result);
        assertEquals("Offre publiée", result.getTitle());
        assertEquals(recipientId, result.getRecipientId());
        assertFalse(result.isRead());
        verify(notificationRepository).save(any());
    }

    /**
     * La configuration des canaux (Parametres > Notifications) doit commander
     * l'envoi : un type desactive par l'administrateur n'est pas notifie.
     */
    @Test
    void send_shouldSkipWhenTypeDisabledInApp() {
        NotificationConfig disabled = mock(NotificationConfig.class);
        when(disabled.getChannel()).thenReturn("IN_APP");
        when(disabled.isEnabled()).thenReturn(false);
        when(configRepository.findByType(NotificationType.ENRICHMENT_REQUIRED)).thenReturn(List.of(disabled));

        Notification result = notificationService.send(
                UUID.randomUUID(), NotificationType.ENRICHMENT_REQUIRED, "Enrichissement requis",
                "Une offre attend son enrichissement", UUID.randomUUID());

        assertNull(result);
        verify(notificationRepository, never()).save(any());
    }

    /** Un type sans ligne de configuration reste notifie : l'absence de reglage n'est pas un refus. */
    @Test
    void send_shouldNotifyWhenNoConfigExists() {
        when(configRepository.findByType(NotificationType.CAMPAIGN_READY)).thenReturn(List.of());
        when(notificationRepository.save(any(Notification.class))).thenAnswer(inv -> inv.getArgument(0));

        Notification result = notificationService.send(
                UUID.randomUUID(), NotificationType.CAMPAIGN_READY, "Offre planifiée",
                "La campagne peut être préparée", UUID.randomUUID());

        assertNotNull(result);
        verify(notificationRepository).save(any());
    }

    @Test
    void countUnread_shouldReturnCount() {
        UUID userId = UUID.randomUUID();
        when(notificationRepository.countByRecipientIdAndReadFalse(userId)).thenReturn(5L);

        long count = notificationService.countUnread(userId);

        assertEquals(5, count);
    }

    @Test
    void markAsRead_shouldSetReadTrue() {
        UUID notifId = UUID.randomUUID();
        Notification notification = new Notification(
                UUID.randomUUID(), NotificationType.CAMPAIGN_READY, "Titre", "Msg", null);
        setField(notification, "id", notifId);

        when(notificationRepository.findById(notifId)).thenReturn(Optional.of(notification));
        when(notificationRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));

        notificationService.markAsRead(notifId);

        assertTrue(notification.isRead());
        verify(notificationRepository).save(notification);
    }

    @Test
    void markAsRead_shouldThrowIfNotFound() {
        UUID fakeId = UUID.randomUUID();
        when(notificationRepository.findById(fakeId)).thenReturn(Optional.empty());

        assertThrows(IllegalArgumentException.class, () -> notificationService.markAsRead(fakeId));
    }

    @Test
    void markAllAsRead_shouldMarkAllUnread() {
        UUID userId = UUID.randomUUID();
        Notification n1 = new Notification(
                userId, NotificationType.OFFER_EXPIRING, "T1", "M1", null);
        Notification n2 = new Notification(
                userId, NotificationType.VALIDATION_REQUIRED, "T2", "M2", null);

        when(notificationRepository.findByRecipientIdAndReadFalseOrderByCreatedAtDesc(userId))
                .thenReturn(List.of(n1, n2));

        notificationService.markAllAsRead(userId);

        assertTrue(n1.isRead());
        assertTrue(n2.isRead());
        verify(notificationRepository).saveAll(List.of(n1, n2));
    }

    @Test
    void delete_shouldCallDeleteById() {
        UUID notifId = UUID.randomUUID();

        notificationService.delete(notifId);

        verify(notificationRepository).deleteById(notifId);
    }

    private static void setField(Object target, String fieldName, Object value) {
        try {
            Field field = target.getClass().getDeclaredField(fieldName);
            field.setAccessible(true);
            field.set(target, value);
        } catch (Exception e) {
            throw new RuntimeException(e);
        }
    }
}
