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

    // CAST(:search AS string) est indispensable : sans lui, un :search null est transmis
    // a PostgreSQL sans type, qui le prend pour un bytea et rejette lower(bytea).
    // La requete echouait donc en 500 des que l'ecran chargeait la liste sans recherche.
    @Query("SELECT o FROM Offer o WHERE" +
            " (:status IS NULL OR o.status = :status)" +
            " AND (:search IS NULL OR LOWER(o.name) LIKE LOWER(CONCAT('%', CAST(:search AS string), '%')))")
    Page<Offer> search(OfferStatus status, String search, Pageable pageable);

    @Query("SELECT o FROM Offer o WHERE o.createdById = :ownerId" +
            " AND (:status IS NULL OR o.status = :status)" +
            " AND (:search IS NULL OR LOWER(o.name) LIKE LOWER(CONCAT('%', CAST(:search AS string), '%')))")
    Page<Offer> searchByOwner(OfferStatus status, String search, UUID ownerId, Pageable pageable);

    /**
     * Charge ouverte d'un analyste : les fiches qui lui sont confiees et qu'il n'a
     * pas encore rendues. C'est la donnee sur laquelle le chef de service arbitre
     * sa repartition.
     */
    long countByAssignedToIdAndStatus(UUID assignedToId, OfferStatus status);

    /** Total des fiches deja confiees a un analyste, tous statuts confondus. */
    long countByAssignedToId(UUID assignedToId);

    /**
     * Offres visibles par un role de diffusion.
     *
     * Le community manager n'a aucune part au cycle de vie : le cahier des charges
     * (l. 107) borne son acces a « la consultation des offres publiees ». La liste
     * complete lui etait pourtant renvoyee, brouillons des autres acteurs compris,
     * et seule l'interface les masquait — alors que la meme specification (l. 118)
     * exige que le perimetre de visibilite soit verifie cote serveur.
     */
    @Query("SELECT o FROM Offer o WHERE o.status IN :statuses" +
            " AND (:search IS NULL OR LOWER(o.name) LIKE LOWER(CONCAT('%', CAST(:search AS string), '%')))")
    Page<Offer> searchWithinStatuses(java.util.Collection<OfferStatus> statuses, String search, Pageable pageable);

    List<Offer> findByStatusIn(java.util.Collection<OfferStatus> statuses);

    @Query("SELECT o FROM Offer o WHERE o.status = 'PLANNED' AND o.validFrom <= :now")
    List<Offer> findPlannedReadyToPublish(LocalDateTime now);

    @Query("SELECT o FROM Offer o WHERE o.status = 'PUBLISHED' AND o.validUntil IS NOT NULL AND o.validUntil <= :now")
    List<Offer> findExpiredOffers(LocalDateTime now);

    @Query("SELECT o FROM Offer o WHERE o.status = 'PUBLISHED' AND o.validUntil IS NOT NULL AND o.validUntil <= :threshold AND o.validUntil > :now")
    List<Offer> findExpiringOffers(LocalDateTime now, LocalDateTime threshold);
}
