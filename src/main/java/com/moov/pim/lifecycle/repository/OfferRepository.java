package com.moov.pim.lifecycle.repository;

import com.moov.pim.lifecycle.domain.Offer;
import com.moov.pim.lifecycle.domain.OfferStatus;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

public interface OfferRepository extends JpaRepository<Offer, UUID> {

    List<Offer> findByCreatedById(UUID userId);

    List<Offer> findByStatus(OfferStatus status);

    @Query("SELECT o FROM Offer o WHERE o.status = 'PLANNED' AND o.validFrom <= :now")
    List<Offer> findPlannedReadyToPublish(LocalDateTime now);

    @Query("SELECT o FROM Offer o WHERE o.status = 'PUBLISHED' AND o.validUntil IS NOT NULL AND o.validUntil <= :now")
    List<Offer> findExpiredOffers(LocalDateTime now);

    @Query("SELECT o FROM Offer o WHERE o.status = 'PUBLISHED' AND o.validUntil IS NOT NULL AND o.validUntil <= :threshold AND o.validUntil > :now")
    List<Offer> findExpiringOffers(LocalDateTime now, LocalDateTime threshold);
}
