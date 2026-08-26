package com.moov.pim.integration.service;

import com.moov.pim.integration.api.dto.IntegrationExportResponse;
import com.moov.pim.integration.api.dto.OfferDiffusionRow;
import com.moov.pim.integration.domain.ExportStatus;
import com.moov.pim.integration.domain.ExportType;
import com.moov.pim.integration.domain.IntegrationExport;
import com.moov.pim.integration.domain.TargetSystem;
import com.moov.pim.integration.repository.IntegrationExportRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.lang.reflect.Field;
import java.util.Collections;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class IntegrationExportServiceTest {

    /** Fiche complete telle que le module du cycle de vie la transmet a la publication. */
    private static final String FICHE =
            "{\"offerId\":\"f1000000-0000-0000-0000-000000000001\",\"name\":\"Pack Convergent\","
                    + "\"status\":\"PUBLISHED\",\"promotionalPrice\":\"15000\",\"currency\":\"XOF\"}";

    @Mock private IntegrationExportRepository exportRepository;

    @InjectMocks private IntegrationExportService exportService;

    @Test
    void triggerAutoExport_shouldExportToAllTargetSystems() {
        UUID offerId = UUID.randomUUID();

        when(exportRepository.existsByOfferIdAndTargetSystemAndStatus(
                eq(offerId), any(), eq(ExportStatus.SUCCESS))).thenReturn(false);
        when(exportRepository.save(any(IntegrationExport.class))).thenAnswer(inv -> {
            IntegrationExport e = inv.getArgument(0);
            setField(e, "id", UUID.randomUUID());
            return e;
        });

        exportService.triggerAutoExport(offerId, FICHE);

        verify(exportRepository, times(TargetSystem.values().length)).save(any());
    }

    /**
     * Le corps de l'export valait la chaine « {} » avant correction, et l'export
     * etait tout de meme marque en succes : la plateforme tracait des diffusions
     * qui ne transportaient rien. La fiche transmise doit se retrouver telle
     * quelle dans chacun des exports produits.
     */
    @Test
    void triggerAutoExport_shouldCarryTheOfferFiche() {
        UUID offerId = UUID.randomUUID();
        ArgumentCaptor<IntegrationExport> saved = ArgumentCaptor.forClass(IntegrationExport.class);

        when(exportRepository.existsByOfferIdAndTargetSystemAndStatus(
                eq(offerId), any(), eq(ExportStatus.SUCCESS))).thenReturn(false);
        when(exportRepository.save(any(IntegrationExport.class))).thenAnswer(inv -> inv.getArgument(0));

        exportService.triggerAutoExport(offerId, FICHE);

        verify(exportRepository, times(TargetSystem.values().length)).save(saved.capture());
        for (IntegrationExport export : saved.getAllValues()) {
            assertEquals(FICHE, export.getPayload());
            assertEquals(ExportStatus.SUCCESS, export.getStatus());
            assertNotNull(export.getCompletedAt());
        }
    }

    /** Une fiche vide n'est pas une diffusion : elle doit partir en echec. */
    @Test
    void triggerAutoExport_shouldFailOnEmptyFiche() {
        UUID offerId = UUID.randomUUID();
        ArgumentCaptor<IntegrationExport> saved = ArgumentCaptor.forClass(IntegrationExport.class);

        when(exportRepository.existsByOfferIdAndTargetSystemAndStatus(
                eq(offerId), any(), eq(ExportStatus.SUCCESS))).thenReturn(false);
        when(exportRepository.save(any(IntegrationExport.class))).thenAnswer(inv -> inv.getArgument(0));

        exportService.triggerAutoExport(offerId, "{}");

        verify(exportRepository, times(TargetSystem.values().length)).save(saved.capture());
        for (IntegrationExport export : saved.getAllValues()) {
            assertEquals(ExportStatus.FAILED, export.getStatus());
            assertNotNull(export.getErrorMessage());
        }
    }

    @Test
    void triggerAutoExport_shouldSkipAlreadySuccessful() {
        UUID offerId = UUID.randomUUID();

        when(exportRepository.existsByOfferIdAndTargetSystemAndStatus(
                eq(offerId), any(), eq(ExportStatus.SUCCESS))).thenReturn(true);

        exportService.triggerAutoExport(offerId, FICHE);

        verify(exportRepository, never()).save(any());
    }

    @Test
    void triggerManualExport_shouldResendTheLastFiche() {
        UUID offerId = UUID.randomUUID();
        IntegrationExport previous = new IntegrationExport();
        previous.setPayload(FICHE);

        when(exportRepository.findFirstByOfferIdAndPayloadIsNotNullOrderByCreatedAtDesc(offerId))
                .thenReturn(Optional.of(previous));
        when(exportRepository.save(any(IntegrationExport.class))).thenAnswer(inv -> {
            IntegrationExport e = inv.getArgument(0);
            setField(e, "id", UUID.randomUUID());
            return e;
        });

        IntegrationExportResponse response = exportService.triggerManualExport(
                offerId, TargetSystem.CRM, ExportType.MANUAL_EXPORT);

        assertNotNull(response);
        assertEquals("CRM", response.targetSystem());
        assertEquals("SUCCESS", response.status());
    }

    /**
     * Une offre jamais publiee n'a aucune fiche a rediffuser. La demande doit etre
     * refusee explicitement, et non produire un export au corps vide.
     */
    @Test
    void triggerManualExport_shouldRefuseWhenNothingWasEverPublished() {
        UUID offerId = UUID.randomUUID();

        when(exportRepository.findFirstByOfferIdAndPayloadIsNotNullOrderByCreatedAtDesc(offerId))
                .thenReturn(Optional.empty());

        assertThrows(IllegalStateException.class, () -> exportService.triggerManualExport(
                offerId, TargetSystem.CRM, ExportType.MANUAL_EXPORT));
        verify(exportRepository, never()).save(any());
    }

    @Test
    void retryFailedExports_shouldRetryAndMarkSuccess() {
        IntegrationExport failed = new IntegrationExport();
        failed.setOfferId(UUID.randomUUID());
        failed.setTargetSystem(TargetSystem.WEBSITE);
        failed.setExportType(ExportType.AUTO_PUBLISH);
        failed.setPayload(FICHE);
        failed.setStatus(ExportStatus.FAILED);
        failed.setRetryCount(1);
        setField(failed, "id", UUID.randomUUID());

        when(exportRepository.findByStatusAndRetryCountLessThan(ExportStatus.FAILED, 3))
                .thenReturn(List.of(failed));
        when(exportRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));

        exportService.retryFailedExports();

        assertEquals(ExportStatus.SUCCESS, failed.getStatus());
        assertEquals(2, failed.getRetryCount());
        verify(exportRepository).save(failed);
    }

    /**
     * La reprise se contentait de basculer FAILED en SUCCESS sans rien retenter :
     * un export sans fiche se reparait tout seul au bout de cinq minutes. Il doit
     * rester en echec.
     */
    @Test
    void retryFailedExports_shouldStayFailedWhenTheFicheIsStillEmpty() {
        IntegrationExport failed = new IntegrationExport();
        failed.setOfferId(UUID.randomUUID());
        failed.setTargetSystem(TargetSystem.WEBSITE);
        failed.setExportType(ExportType.AUTO_PUBLISH);
        failed.setPayload(null);
        failed.setStatus(ExportStatus.FAILED);
        failed.setRetryCount(1);
        setField(failed, "id", UUID.randomUUID());

        when(exportRepository.findByStatusAndRetryCountLessThan(ExportStatus.FAILED, 3))
                .thenReturn(List.of(failed));
        when(exportRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));

        exportService.retryFailedExports();

        assertEquals(ExportStatus.FAILED, failed.getStatus());
        assertEquals(2, failed.getRetryCount());
    }

    @Test
    void retryFailedExports_shouldDoNothingIfNoneFailed() {
        when(exportRepository.findByStatusAndRetryCountLessThan(ExportStatus.FAILED, 3))
                .thenReturn(Collections.emptyList());

        exportService.retryFailedExports();

        verify(exportRepository, never()).save(any());
    }

    // ===================================================================
    // Rapprochement avec les systemes tiers
    //
    // Responsabilite du chef de departement (cahier des charges l. 106) : ayant
    // publie les offres, il doit pouvoir constater lesquelles ne sont pas
    // arrivees a destination.
    // ===================================================================

    @Test
    void reconciliation_shouldReportTheStatusOfEachTargetSystem() {
        UUID offerId = UUID.randomUUID();

        when(exportRepository.findAll()).thenReturn(List.of(
                export(offerId, TargetSystem.CRM, ExportStatus.SUCCESS),
                export(offerId, TargetSystem.CALL_CENTER, ExportStatus.FAILED)));

        List<OfferDiffusionRow> rows = exportService.reconciliation();

        assertEquals(1, rows.size());
        assertEquals(offerId, rows.get(0).offerId());
        assertEquals("SUCCESS", rows.get(0).statusByTarget().get("CRM"));
        assertEquals("FAILED", rows.get(0).statusByTarget().get("CALL_CENTER"));
        // Le site web n'a jamais recu la fiche : il est simplement absent, et c'est
        // l'ecran appelant qui l'interprete comme « jamais diffusee ».
        assertNull(rows.get(0).statusByTarget().get("WEBSITE"));
    }

    /**
     * Un echec suivi d'une reprise reussie est une diffusion reussie, pas un
     * incident en cours : c'est le statut le plus favorable qui doit ressortir,
     * quel que soit l'ordre de lecture des lignes.
     */
    @Test
    void reconciliation_shouldKeepTheMostFavourableStatusPerTarget() {
        UUID offerId = UUID.randomUUID();

        when(exportRepository.findAll()).thenReturn(List.of(
                export(offerId, TargetSystem.CRM, ExportStatus.FAILED),
                export(offerId, TargetSystem.CRM, ExportStatus.SUCCESS)));

        List<OfferDiffusionRow> rows = exportService.reconciliation();

        assertEquals("SUCCESS", rows.get(0).statusByTarget().get("CRM"));
    }

    @Test
    void reconciliation_shouldBeEmptyWhenNothingWasEverDistributed() {
        when(exportRepository.findAll()).thenReturn(Collections.emptyList());

        assertTrue(exportService.reconciliation().isEmpty());
    }

    private static IntegrationExport export(UUID offerId, TargetSystem target, ExportStatus status) {
        IntegrationExport export = new IntegrationExport();
        export.setOfferId(offerId);
        export.setTargetSystem(target);
        export.setExportType(ExportType.AUTO_PUBLISH);
        export.setStatus(status);
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
