package com.moov.pim.lifecycle.repository;

import com.moov.pim.lifecycle.domain.Offer;
import com.moov.pim.lifecycle.domain.OfferStatus;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

public interface OfferRepository extends JpaRepository<Offer, UUID> {

    List<Offer> findByCreatedById(UUID userId);

    Page<Offer> findByCreatedById(UUID userId, Pageable pageable);

    List<Offer> findByStatus(OfferStatus status);

    List<Offer> findByStatusAndCreatedById(OfferStatus status, UUID createdById);

    Page<Offer> findByStatus(OfferStatus status, Pageable pageable);

    @Query("SELECT o FROM Offer o WHERE" +
            " (:status IS NULL OR o.status = :status)" +
            " AND (:search IS NULL OR LOWER(o.name) LIKE LOWER(CONCAT('%', :search, '%')))")
    Page<Offer> search(OfferStatus status, String search, Pageable pageable);

    @Query("SELECT o FROM Offer o WHERE o.createdById = :ownerId" +
            " AND (:status IS NULL OR o.status = :status)" +
            " AND (:search IS NULL OR LOWER(o.name) LIKE LOWER(CONCAT('%', :search, '%')))")
    Page<Offer> searchByOwner(OfferStatus status, String search, UUID ownerId, Pageable pageable);

    @Query("SELECT o FROM Offer o WHERE o.status = 'PLANNED' AND o.validFrom <= :now")
    List<Offer> findPlannedReadyToPublish(LocalDateTime now);

    @Query("SELECT o FROM Offer o WHERE o.status = 'PUBLISHED' AND o.validUntil IS NOT NULL AND o.validUntil <= :now")
    List<Offer> findExpiredOffers(LocalDateTime now);

    @Query("SELECT o FROM Offer o WHERE o.status = 'PUBLISHED' AND o.validUntil IS NOT NULL AND o.validUntil <= :threshold AND o.validUntil > :now")
    List<Offer> findExpiringOffers(LocalDateTime now, LocalDateTime threshold);
}
