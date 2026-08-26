package com.moov.pim.analytics.service;

import com.moov.pim.analytics.api.dto.KpiSummaryResponse;
import com.moov.pim.analytics.domain.KpiEvent;
import com.moov.pim.analytics.repository.KpiEventRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Duration;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * Calcul des indicateurs de la section 7.9 du cahier des charges.
 *
 * Le principe : la table kpi_events porte, pour chaque offre, la suite ordonnee
 * de ses evenements reels (OFFER_CREATED puis un STATUS_* par transition). Le
 * temps passe dans une etape est l'ecart entre l'evenement qui y fait entrer et
 * celui qui en fait sortir ; le Time To Market est l'ecart entre la creation et
 * le passage a PUBLISHED. Rien n'est estime ni extrapole : une offre qui n'a
 * jamais ete publiee ne contribue pas au Time To Market, et une etape dont on
 * n'est jamais sorti ne contribue pas au temps moyen.
 */
@Service
public class KpiSummaryService {

    /** Etape initiale : l'evenement de creation ouvre le sejour en brouillon. */
    private static final String CREATION_EVENT = "OFFER_CREATED";
    private static final String STATUS_PREFIX = "STATUS_";
    private static final String INITIAL_STAGE = "DRAFT";
    private static final String PUBLISHED_STAGE = "PUBLISHED";

    private final KpiEventRepository kpiEventRepository;

    public KpiSummaryService(KpiEventRepository kpiEventRepository) {
        this.kpiEventRepository = kpiEventRepository;
    }

    /**
     * @param from      debut de la periode observee.
     * @param to        fin de la periode observee.
     * @param teamScope true si le compte detient ANALYTICS_TEAM_VIEW.
     * @param actorId   compte connecte, seul retenu lorsque teamScope est faux.
     */
    @Transactional(readOnly = true)
    public KpiSummaryResponse summarize(LocalDateTime from, LocalDateTime to,
                                        boolean teamScope, UUID actorId) {

        List<KpiEvent> events = kpiEventRepository.findByPeriod(from, to);

        // Regroupement par offre, chaque suite remise dans l'ordre chronologique :
        // findByPeriod trie du plus recent au plus ancien, l'inverse de ce dont le
        // calcul des ecarts a besoin.
        Map<UUID, List<KpiEvent>> byOffer = new LinkedHashMap<>();
        for (KpiEvent event : events) {
            if (event.getOfferId() == null) continue;
            byOffer.computeIfAbsent(event.getOfferId(), key -> new ArrayList<>()).add(event);
        }
        byOffer.values().forEach(list -> list.sort(Comparator.comparing(KpiEvent::getCreatedAt)));

        List<KpiSummaryResponse.OfferTimeToMarket> ttm = new ArrayList<>();
        Map<String, List<Long>> dwellByStage = new LinkedHashMap<>();

        for (Map.Entry<UUID, List<KpiEvent>> entry : byOffer.entrySet()) {
            List<KpiEvent> timeline = entry.getValue();

            LocalDateTime createdAt = null;
            String currentStage = null;
            LocalDateTime enteredAt = null;

            for (KpiEvent event : timeline) {
                String type = event.getEventType();

                if (CREATION_EVENT.equals(type)) {
                    createdAt = event.getCreatedAt();
                    currentStage = INITIAL_STAGE;
                    enteredAt = event.getCreatedAt();
                    continue;
                }
                if (type == null || !type.startsWith(STATUS_PREFIX)) continue;

                String reachedStage = type.substring(STATUS_PREFIX.length());

                // Sortie de l'etape precedente : c'est la duree de sejour. En vue
                // individuelle, seules les transitions realisees par le compte
                // connecte sont comptees — c'est son temps de traitement a lui.
                if (currentStage != null && enteredAt != null
                        && (teamScope || actorId.equals(event.getActorId()))) {
                    long ms = Duration.between(enteredAt, event.getCreatedAt()).toMillis();
                    if (ms >= 0) {
                        dwellByStage.computeIfAbsent(currentStage, key -> new ArrayList<>()).add(ms);
                    }
                }

                if (teamScope && PUBLISHED_STAGE.equals(reachedStage) && createdAt != null) {
                    long ms = Duration.between(createdAt, event.getCreatedAt()).toMillis();
                    if (ms >= 0) {
                        ttm.add(new KpiSummaryResponse.OfferTimeToMarket(entry.getKey(), ms));
                    }
                }

                currentStage = reachedStage;
                enteredAt = event.getCreatedAt();
            }
        }

        ttm.sort(Comparator.comparingLong(KpiSummaryResponse.OfferTimeToMarket::durationMs).reversed());

        List<KpiSummaryResponse.StageStat> stages = new ArrayList<>();
        for (Map.Entry<String, List<Long>> entry : dwellByStage.entrySet()) {
            List<Long> durations = entry.getValue();
            long average = Math.round(durations.stream().mapToLong(Long::longValue).average().orElse(0));
            stages.add(new KpiSummaryResponse.StageStat(entry.getKey(), average, durations.size()));
        }
        stages.sort(Comparator.comparingLong(KpiSummaryResponse.StageStat::averageMs).reversed());

        // Le goulot d'etranglement est l'etape la plus lente. Il n'a de sens qu'en
        // vue equipe : le temps de traitement d'une seule personne ne designe pas
        // un goulot dans le circuit.
        String bottleneck = (teamScope && !stages.isEmpty()) ? stages.get(0).stage() : null;

        return new KpiSummaryResponse(
                teamScope ? "TEAM" : "SELF",
                byOffer.size(),
                ttm.size(),
                median(ttm),
                average(ttm),
                ttm,
                stages,
                bottleneck);
    }

    private Long median(List<KpiSummaryResponse.OfferTimeToMarket> ttm) {
        if (ttm.isEmpty()) return null;
        List<Long> sorted = ttm.stream()
                .map(KpiSummaryResponse.OfferTimeToMarket::durationMs)
                .sorted()
                .toList();
        int middle = sorted.size() / 2;
        return sorted.size() % 2 == 1
                ? sorted.get(middle)
                : Math.round((sorted.get(middle - 1) + sorted.get(middle)) / 2.0);
    }

    private Long average(List<KpiSummaryResponse.OfferTimeToMarket> ttm) {
        if (ttm.isEmpty()) return null;
        return Math.round(ttm.stream()
                .mapToLong(KpiSummaryResponse.OfferTimeToMarket::durationMs)
                .average()
                .orElse(0));
    }
}
