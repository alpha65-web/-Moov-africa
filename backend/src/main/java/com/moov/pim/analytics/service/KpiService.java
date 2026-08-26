package com.moov.pim.analytics.service;

import com.moov.pim.analytics.api.dto.KpiEventResponse;
import com.moov.pim.analytics.domain.KpiEvent;
import com.moov.pim.analytics.repository.KpiEventRepository;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.UUID;

@Service
public class KpiService {

    private final KpiEventRepository kpiEventRepository;

    public KpiService(KpiEventRepository kpiEventRepository) {
        this.kpiEventRepository = kpiEventRepository;
    }

    @Transactional
    public KpiEvent record(UUID offerId, String eventType, UUID actorId, Long durationMs) {
        KpiEvent event = new KpiEvent(offerId, eventType, actorId);
        event.setDurationMs(durationMs);
        return kpiEventRepository.save(event);
    }

    @Transactional(readOnly = true)
    public Page<KpiEventResponse> getByOffer(UUID offerId, Pageable pageable) {
        return kpiEventRepository.findByOfferId(offerId, pageable).map(KpiEventResponse::from);
    }

    /**
     * Flux d'evenements, borne au perimetre du demandeur.
     *
     * @param teamScope vrai si le demandeur detient ANALYTICS_TEAM_VIEW. Sans quoi
     *                  il ne recoit que les evenements dont il est l'auteur, comme
     *                  la synthese le fait deja. Le perimetre est decide par
     *                  l'appelant a partir des permissions, jamais par un parametre
     *                  de requete : sinon il suffirait de modifier l'adresse
     *                  appelee pour lire les chiffres de ses collegues.
     */
    @Transactional(readOnly = true)
    public Page<KpiEventResponse> getByPeriod(LocalDateTime from, LocalDateTime to,
                                              boolean teamScope, UUID actorId, Pageable pageable) {
        return (teamScope
                ? kpiEventRepository.findByPeriod(from, to, pageable)
                : kpiEventRepository.findByActorAndPeriod(actorId, from, to, pageable))
                .map(KpiEventResponse::from);
    }
}
