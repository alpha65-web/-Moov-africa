package com.moov.pim.analytics.service;

import com.moov.pim.analytics.api.dto.KpiSummaryResponse;
import com.moov.pim.analytics.domain.KpiEvent;
import com.moov.pim.analytics.repository.KpiEventRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.lang.reflect.Field;
import java.time.Duration;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.when;

/**
 * Verifie que les indicateurs sont bien deduits des evenements reels.
 *
 * Le point sensible est l'ordre : le repository renvoie les evenements du plus
 * recent au plus ancien, alors que le calcul des ecarts suppose l'ordre
 * chronologique. Une erreur a cet endroit produit des durees negatives ou nulles
 * sans lever d'exception, donc des indicateurs faux mais d'apparence plausible.
 */
@ExtendWith(MockitoExtension.class)
class KpiSummaryServiceTest {

    @Mock private KpiEventRepository kpiEventRepository;

    private KpiSummaryService service;

    private final LocalDateTime start = LocalDateTime.of(2026, 1, 5, 8, 0);
    private final UUID analyste = UUID.randomUUID();
    private final UUID chefProduit = UUID.randomUUID();

    @BeforeEach
    void setUp() {
        service = new KpiSummaryService(kpiEventRepository);
    }

    @Test
    void summarize_shouldComputeTimeToMarketFromCreationToPublication() {
        UUID offerId = UUID.randomUUID();
        // Le repository trie du plus recent au plus ancien : on le reproduit ici
        // pour verifier que le service remet bien la chronologie a l'endroit.
        when(kpiEventRepository.findByPeriod(any(), any())).thenReturn(List.of(
                event(offerId, "STATUS_PUBLISHED", chefProduit, start.plusDays(6)),
                event(offerId, "STATUS_VALIDATED", chefProduit, start.plusDays(4)),
                event(offerId, "STATUS_IN_VALIDATION", analyste, start.plusDays(3)),
                event(offerId, "STATUS_IN_ENRICHMENT", chefProduit, start.plusDays(1)),
                event(offerId, "OFFER_CREATED", chefProduit, start)));

        KpiSummaryResponse summary = summarizeTeam();

        assertEquals("TEAM", summary.scope());
        assertEquals(1, summary.publishedOffers());
        assertEquals(Duration.ofDays(6).toMillis(), summary.ttmMedianMs());
        assertEquals(1, summary.ttmByOffer().size());
        assertEquals(offerId, summary.ttmByOffer().get(0).offerId());
    }

    @Test
    void summarize_shouldMeasureTimeSpentInEachStage() {
        UUID offerId = UUID.randomUUID();
        when(kpiEventRepository.findByPeriod(any(), any())).thenReturn(List.of(
                event(offerId, "STATUS_IN_VALIDATION", analyste, start.plusDays(5)),
                event(offerId, "STATUS_IN_ENRICHMENT", chefProduit, start.plusDays(1)),
                event(offerId, "OFFER_CREATED", chefProduit, start)));

        KpiSummaryResponse summary = summarizeTeam();

        // Un jour en brouillon, puis quatre jours en enrichissement.
        assertEquals(Duration.ofDays(1).toMillis(), stage(summary, "DRAFT").averageMs());
        assertEquals(Duration.ofDays(4).toMillis(), stage(summary, "IN_ENRICHMENT").averageMs());
    }

    @Test
    void summarize_shouldDesignateTheSlowestStageAsBottleneck() {
        UUID offerId = UUID.randomUUID();
        when(kpiEventRepository.findByPeriod(any(), any())).thenReturn(List.of(
                event(offerId, "STATUS_IN_VALIDATION", analyste, start.plusDays(9)),
                event(offerId, "STATUS_IN_ENRICHMENT", chefProduit, start.plusDays(1)),
                event(offerId, "OFFER_CREATED", chefProduit, start)));

        assertEquals("IN_ENRICHMENT", summarizeTeam().bottleneckStage());
    }

    @Test
    void summarize_selfScope_shouldOnlyCountTransitionsMadeByTheUser() {
        UUID offerId = UUID.randomUUID();
        when(kpiEventRepository.findByPeriod(any(), any())).thenReturn(List.of(
                event(offerId, "STATUS_IN_VALIDATION", analyste, start.plusDays(5)),
                event(offerId, "STATUS_IN_ENRICHMENT", chefProduit, start.plusDays(1)),
                event(offerId, "OFFER_CREATED", chefProduit, start)));

        KpiSummaryResponse summary = service.summarize(
                start.minusDays(1), start.plusDays(30), false, analyste);

        assertEquals("SELF", summary.scope());
        // Seule la transition realisee par l'analyste est retenue : les quatre jours
        // passes en enrichissement, dont il est sorti.
        assertEquals(1, summary.stages().size());
        assertEquals("IN_ENRICHMENT", summary.stages().get(0).stage());
        // Ni Time To Market ni goulot d'etranglement : ce ne sont pas ses indicateurs.
        assertNull(summary.ttmMedianMs());
        assertNull(summary.bottleneckStage());
        assertTrue(summary.ttmByOffer().isEmpty());
    }

    @Test
    void summarize_shouldReturnEmptyValuesRatherThanZeroesWhenNothingHappened() {
        when(kpiEventRepository.findByPeriod(any(), any())).thenReturn(List.of());

        KpiSummaryResponse summary = summarizeTeam();

        assertEquals(0, summary.trackedOffers());
        assertNull(summary.ttmMedianMs());
        assertNull(summary.ttmAverageMs());
        assertNull(summary.bottleneckStage());
        assertTrue(summary.stages().isEmpty());
    }

    @Test
    void summarize_shouldIgnoreOffersNeverPublishedInTimeToMarket() {
        UUID published = UUID.randomUUID();
        UUID stillDraft = UUID.randomUUID();
        List<KpiEvent> events = new ArrayList<>(List.of(
                event(published, "STATUS_PUBLISHED", chefProduit, start.plusDays(2)),
                event(published, "OFFER_CREATED", chefProduit, start),
                event(stillDraft, "OFFER_CREATED", chefProduit, start)));
        when(kpiEventRepository.findByPeriod(any(), any())).thenReturn(events);

        KpiSummaryResponse summary = summarizeTeam();

        assertEquals(2, summary.trackedOffers());
        assertEquals(1, summary.publishedOffers());
    }

    private KpiSummaryResponse summarizeTeam() {
        return service.summarize(start.minusDays(1), start.plusDays(30), true, chefProduit);
    }

    private KpiSummaryResponse.StageStat stage(KpiSummaryResponse summary, String name) {
        return summary.stages().stream()
                .filter(s -> s.stage().equals(name))
                .findFirst()
                .orElseThrow(() -> new AssertionError("Etape absente du resultat : " + name));
    }

    /** createdAt est renseigne par @PrePersist : en test, il faut le poser soi-meme. */
    private KpiEvent event(UUID offerId, String type, UUID actorId, LocalDateTime at) {
        KpiEvent event = new KpiEvent(offerId, type, actorId);
        try {
            Field field = KpiEvent.class.getDeclaredField("createdAt");
            field.setAccessible(true);
            field.set(event, at);
        } catch (Exception e) {
            throw new RuntimeException(e);
        }
        return event;
    }
}
