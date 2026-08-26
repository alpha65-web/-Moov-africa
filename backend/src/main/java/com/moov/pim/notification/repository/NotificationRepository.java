package com.moov.pim.notification.repository;

import com.moov.pim.notification.domain.Notification;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.UUID;

public interface NotificationRepository extends JpaRepository<Notification, UUID> {

    List<Notification> findByRecipientIdOrderByCreatedAtDesc(UUID recipientId);

    Page<Notification> findByRecipientIdOrderByCreatedAtDesc(UUID recipientId, Pageable pageable);

    List<Notification> findByRecipientIdAndReadFalseOrderByCreatedAtDesc(UUID recipientId);

    Page<Notification> findByRecipientIdAndReadFalseOrderByCreatedAtDesc(UUID recipientId, Pageable pageable);

    long countByRecipientIdAndReadFalse(UUID recipientId);

    /**
     * Une alerte de meme nature a-t-elle deja ete envoyee sur cette offre ?
     *
     * L'alerte d'expiration est produite par un balayage horaire : sans ce
     * controle, une offre expirant dans sept jours generait cent soixante-huit
     * notifications identiques a son auteur, qui noieraient tout le reste.
     */
    boolean existsByRecipientIdAndTypeAndRelatedOfferId(UUID recipientId,
                                                        com.moov.pim.notification.domain.NotificationType type,
                                                        UUID relatedOfferId);
}
