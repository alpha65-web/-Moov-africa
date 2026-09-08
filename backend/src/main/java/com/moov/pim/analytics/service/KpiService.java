package com.moov.pim.analytics.service;

import com.moov.pim.analytics.api.dto.KpiEventResponse;
import com.moov.pim.analytics.domain.KpiEvent;
import com.moov.pim.analytics.repository.KpiEventRepository;
import com.moov.pim.lifecycle.domain.Offer;
import com.moov.pim.lifecycle.repository.OfferRepository;
import com.moov.pim.permissions.domain.User;
import com.moov.pim.permissions.repository.UserRepository;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.Map;
import java.util.Objects;
import java.util.UUID;
import java.util.function.Function;
import java.util.stream.Collectors;

@Service
public class KpiService {

    private final KpiEventRepository kpiEventRepository;
    private final OfferRepository offerRepository;
    private final UserRepository userRepository;

    public KpiService(KpiEventRepository kpiEventRepository,
                      OfferRepository offerRepository,
                      UserRepository userRepository) {
        this.kpiEventRepository = kpiEventRepository;
        this.offerRepository = offerRepository;
        this.userRepository = userRepository;
    }

    @Transactional
    public KpiEvent record(UUID offerId, String eventType, UUID actorId, Long durationMs) {
        KpiEvent event = new KpiEvent(offerId, eventType, actorId);
        event.setDurationMs(durationMs);
        return kpiEventRepository.save(event);
    }

    @Transactional(readOnly = true)
    public Page<KpiEventResponse> getByOffer(UUID offerId, Pageable pageable) {
        return withNames(kpiEventRepository.findByOfferId(offerId, pageable));
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
        return withNames(teamScope
                ? kpiEventRepository.findByPeriod(from, to, pageable)
                : kpiEventRepository.findByActorAndPeriod(actorId, from, to, pageable));
    }

    /** Projette une page d'evenements avec les noms d'offre et d'acteur, en deux lectures groupees. */
    private Page<KpiEventResponse> withNames(Page<KpiEvent> page) {
        Map<UUID, String> offerNames = offerRepository.findAllById(
                        page.getContent().stream().map(KpiEvent::getOfferId).filter(Objects::nonNull).collect(Collectors.toSet()))
                .stream().collect(Collectors.toMap(Offer::getId, Offer::getName, (a, b) -> a));
        Map<UUID, String> actorNames = userRepository.findAllById(
                        page.getContent().stream().map(KpiEvent::getActorId).filter(Objects::nonNull).collect(Collectors.toSet()))
                .stream().collect(Collectors.toMap(User::getId, u -> u.getFirstName() + " " + u.getLastName(), (a, b) -> a));

        return page.map(e -> KpiEventResponse.from(e, offerNames.get(e.getOfferId()), actorNames.get(e.getActorId())));
    }
}
