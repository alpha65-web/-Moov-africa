package com.moov.pim.integration.service;

import com.moov.pim.integration.api.dto.FeedEntry;
import com.moov.pim.integration.domain.ExportStatus;
import com.moov.pim.integration.domain.ExportType;
import com.moov.pim.integration.domain.IntegrationExport;
import com.moov.pim.integration.domain.TargetSystem;
import com.moov.pim.integration.repository.IntegrationExportRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;

import java.lang.reflect.Field;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

/**
 * Flux consomme en temps reel par les systemes tiers.
 *
 * Le canal « API » exige par le sujet n'existait pas : les seules routes ouvertes,
 * sous /exports, servent l'administration interne et reclament un jeton
 * d'utilisateur de la plateforme, qu'un CRM n'a pas.
 */
@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class ConsumerFeedServiceTest {

    private static final String FICHE =
            "{\"offerId\":\"f1000000-0000-0000-0000-000000000001\",\"name\":\"Pack Convergent\"}";

    @Mock private IntegrationExportRepository exportRepository;

    private ConsumerFeedService feedService;

    @BeforeEach
    void setUp() {
        feedService = new ConsumerFeedService(exportRepository);
        when(exportRepository.save(any(IntegrationExport.class))).thenAnswer(inv -> inv.getArgument(0));
    }

    @Test
    void feedFor_shouldServeTheFicheOfEachPublishedOffer() {
        UUID offerId = UUID.randomUUID();
        when(exportRepository.findByTargetSystemAndPayloadIsNotNullOrderByCreatedAtDesc(TargetSystem.CRM))
                .thenReturn(List.of(export(offerId, ExportType.AUTO_PUBLISH, ExportStatus.PENDING, now())));

        List<FeedEntry> entries = feedService.feedFor(TargetSystem.CRM, null);

        assertEquals(1, entries.size());
        assertEquals(offerId, entries.get(0).offerId());
        assertEquals("ACTIVE", entries.get(0).state());
        assertEquals("Pack Convergent", ((Map<?, ?>) entries.get(0).fiche()).get("name"));
    }

    /**
     * Une fiche mise a disposition mais jamais lue n'est pas une fiche diffusee.
     * C'est la lecture par le destinataire, et elle seule, qui fait passer l'export
     * en succes — sans quoi le statut redeviendrait une affirmation sans preuve.
     */
    @Test
    void feedFor_shouldMarkTheExportAsDeliveredOnFirstRead() {
        IntegrationExport export = export(UUID.randomUUID(), ExportType.AUTO_PUBLISH, ExportStatus.PENDING, now());
        when(exportRepository.findByTargetSystemAndPayloadIsNotNullOrderByCreatedAtDesc(TargetSystem.CRM))
                .thenReturn(List.of(export));

        feedService.feedFor(TargetSystem.CRM, null);

        assertEquals(ExportStatus.SUCCESS, export.getStatus());
        assertNotNull(export.getConsumedAt());
        assertNotNull(export.getCompletedAt());
        assertEquals(1, export.getConsumedCount());
    }

    /**
     * Le retrait doit voyager comme la publication : un destinataire qui ne
     * recevrait que les offres actives ne saurait jamais qu'une offre a ete
     * retiree, et continuerait de la proposer.
     */
    @Test
    void feedFor_shouldReportWithdrawnOffers() {
        UUID offerId = UUID.randomUUID();
        when(exportRepository.findByTargetSystemAndPayloadIsNotNullOrderByCreatedAtDesc(TargetSystem.CALL_CENTER))
                .thenReturn(List.of(
                        export(offerId, ExportType.WITHDRAWAL, ExportStatus.PENDING, now()),
                        export(offerId, ExportType.AUTO_PUBLISH, ExportStatus.SUCCESS, now().minusDays(1))));

        List<FeedEntry> entries = feedService.feedFor(TargetSystem.CALL_CENTER, null);

        assertEquals(1, entries.size(), "seul le dernier etat de l'offre est servi");
        assertEquals("WITHDRAWN", entries.get(0).state());
    }

    /** Une fiche en echec n'a rien a faire dans le flux : elle n'est pas diffusable. */
    @Test
    void feedFor_shouldIgnoreFailedExports() {
        when(exportRepository.findByTargetSystemAndPayloadIsNotNullOrderByCreatedAtDesc(TargetSystem.WEBSITE))
                .thenReturn(List.of(export(UUID.randomUUID(), ExportType.AUTO_PUBLISH, ExportStatus.FAILED, now())));

        assertTrue(feedService.feedFor(TargetSystem.WEBSITE, null).isEmpty());
    }

    /**
     * La consultation incrementale est ce qui rend un appel frequent tenable : le
     * systeme tiers rappelle le flux avec l'horodatage de sa derniere
     * synchronisation au lieu de retelecharger tout le catalogue.
     */
    @Test
    void feedFor_shouldOnlyReturnWhatChangedSince() {
        when(exportRepository.findByTargetSystemAndPayloadIsNotNullOrderByCreatedAtDesc(TargetSystem.CRM))
                .thenReturn(List.of(
                        export(UUID.randomUUID(), ExportType.AUTO_PUBLISH, ExportStatus.PENDING, now()),
                        export(UUID.randomUUID(), ExportType.AUTO_PUBLISH, ExportStatus.PENDING,
                                now().minusDays(3))));

        List<FeedEntry> entries = feedService.feedFor(TargetSystem.CRM, now().minusDays(1));

        assertEquals(1, entries.size());
    }

    @Test
    void entryFor_shouldRefuseAnOfferNeverSentToThatChannel() {
        when(exportRepository.findByTargetSystemAndPayloadIsNotNullOrderByCreatedAtDesc(TargetSystem.CRM))
                .thenReturn(List.of());

        assertThrows(IllegalArgumentException.class,
                () -> feedService.entryFor(TargetSystem.CRM, UUID.randomUUID()));
    }

    private static LocalDateTime now() {
        return LocalDateTime.now();
    }

    private static IntegrationExport export(UUID offerId, ExportType type, ExportStatus status,
                                            LocalDateTime createdAt) {
        IntegrationExport export = new IntegrationExport();
        export.setOfferId(offerId);
        export.setTargetSystem(TargetSystem.CRM);
        export.setExportType(type);
        export.setStatus(status);
        export.setPayload(FICHE);
        setField(export, "id", UUID.randomUUID());
        setField(export, "createdAt", createdAt);
        return export;
    }

    private static void setField(Object target, String fieldName, Object value) {
        try {
            Field field = target.getClass().getDeclaredField(fieldName);
            field.setAccessible(true);
            field.set(target, value);
        } catch (Exception e) {
            throw new RuntimeException(e);
        }
    }
}
