package com.moov.pim.notification.service;

import com.moov.pim.notification.api.dto.NotificationResponse;
import com.moov.pim.notification.domain.Notification;
import com.moov.pim.notification.domain.NotificationType;
import com.moov.pim.notification.repository.NotificationConfigRepository;
import com.moov.pim.notification.repository.NotificationRepository;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.UUID;

@Service
public class NotificationService {

    private static final String IN_APP = "IN_APP";

    private final NotificationRepository notificationRepository;
    private final NotificationConfigRepository configRepository;

    public NotificationService(NotificationRepository notificationRepository,
                               NotificationConfigRepository configRepository) {
        this.notificationRepository = notificationRepository;
        this.configRepository = configRepository;
    }

    /**
     * Emet une notification dans l'application, si l'administrateur n'a pas
     * desactive ce type.
     *
     * La configuration des canaux (Parametres > Notifications) etait enregistree
     * mais jamais consultee : un type desactive continuait d'etre notifie, et les
     * interrupteurs de l'ecran ne commandaient rien. Elle est desormais lue a
     * chaque envoi. Un type sans ligne de configuration reste notifie : l'absence
     * de reglage n'est pas un refus.
     *
     * @return la notification enregistree, ou null si ce type est desactive
     */
    @Transactional
    public Notification send(UUID recipientId, NotificationType type, String title, String message, UUID relatedOfferId) {
        if (!inAppEnabled(type)) {
            return null;
        }
        Notification notification = new Notification(recipientId, type, title, message, relatedOfferId);
        return notificationRepository.save(notification);
    }

    private boolean inAppEnabled(NotificationType type) {
        List<com.moov.pim.notification.domain.NotificationConfig> configs = configRepository.findByType(type);
        if (configs.isEmpty()) return true;
        return configs.stream().anyMatch(c -> IN_APP.equals(c.getChannel()) && c.isEnabled());
    }

    @Transactional(readOnly = true)
    public Page<NotificationResponse> listForUser(UUID userId, Pageable pageable) {
        return notificationRepository.findByRecipientIdOrderByCreatedAtDesc(userId, pageable)
                .map(NotificationResponse::from);
    }

    @Transactional(readOnly = true)
    public Page<NotificationResponse> listUnreadForUser(UUID userId, Pageable pageable) {
        return notificationRepository.findByRecipientIdAndReadFalseOrderByCreatedAtDesc(userId, pageable)
                .map(NotificationResponse::from);
    }

    @Transactional(readOnly = true)
    public long countUnread(UUID userId) {
        return notificationRepository.countByRecipientIdAndReadFalse(userId);
    }

    @Transactional
    public void markAsRead(UUID notificationId) {
        Notification notification = notificationRepository.findById(notificationId)
                .orElseThrow(() -> new IllegalArgumentException("Notification introuvable"));
        notification.setRead(true);
        notificationRepository.save(notification);
    }

    @Transactional
    public void markAllAsRead(UUID userId) {
        List<Notification> unread = notificationRepository
                .findByRecipientIdAndReadFalseOrderByCreatedAtDesc(userId);
        unread.forEach(n -> n.setRead(true));
        notificationRepository.saveAll(unread);
    }

    @Transactional
    public void delete(UUID notificationId) {
        notificationRepository.deleteById(notificationId);
    }
}
