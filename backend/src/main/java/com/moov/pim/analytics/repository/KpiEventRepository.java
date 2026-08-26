package com.moov.pim.analytics.repository;

import com.moov.pim.analytics.domain.KpiEvent;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

public interface KpiEventRepository extends JpaRepository<KpiEvent, UUID> {

    List<KpiEvent> findByOfferId(UUID offerId);

    Page<KpiEvent> findByOfferId(UUID offerId, Pageable pageable);

    List<KpiEvent> findByEventType(String eventType);

    @Query("SELECT k FROM KpiEvent k WHERE k.createdAt >= :from AND k.createdAt <= :to ORDER BY k.createdAt DESC")
    List<KpiEvent> findByPeriod(LocalDateTime from, LocalDateTime to);

    @Query("SELECT k FROM KpiEvent k WHERE k.createdAt >= :from AND k.createdAt <= :to ORDER BY k.createdAt DESC")
    Page<KpiEvent> findByPeriod(LocalDateTime from, LocalDateTime to, Pageable pageable);

    /**
     * Evenements produits par un acteur donne sur une periode.
     *
     * Le perimetre individuel du cahier des charges (section 7.9 : « l'analyste
     * marketing ne voit que son propre temps de traitement ») etait applique au
     * seul endpoint de synthese. Le flux d'evenements, lui, restait ouvert : un
     * analyste voyait donc l'activite de toute l'equipe dans le tableau situe
     * immediatement sous un bloc annoncant « votre temps de traitement ».
     */
    @Query("SELECT k FROM KpiEvent k WHERE k.actorId = :actorId" +
            " AND k.createdAt >= :from AND k.createdAt <= :to ORDER BY k.createdAt DESC")
    Page<KpiEvent> findByActorAndPeriod(UUID actorId, LocalDateTime from, LocalDateTime to, Pageable pageable);
}
