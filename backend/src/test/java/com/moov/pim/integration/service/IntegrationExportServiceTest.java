package com.moov.pim.integration.service;

import com.moov.pim.integration.api.dto.IntegrationExportResponse;
import com.moov.pim.integration.api.dto.OfferDiffusionRow;
import com.moov.pim.integration.domain.DeliveryMode;
import com.moov.pim.integration.domain.ExportStatus;
import com.moov.pim.integration.domain.ExportType;
import com.moov.pim.integration.domain.IntegrationEndpoint;
import com.moov.pim.integration.domain.IntegrationExport;
import com.moov.pim.integration.domain.TargetSystem;
import com.moov.pim.integration.repository.IntegrationEndpointRepository;
import com.moov.pim.integration.repository.IntegrationExportRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;
import org.springframework.http.MediaType;
import org.springframework.test.web.client.MockRestServiceServer;
import org.springframework.web.client.RestClient;

import java.lang.reflect.Field;
import java.util.Collections;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.requestTo;
import static org.springframework.test.web.client.response.MockRestResponseCreators.withServerError;
import static org.springframework.test.web.client.response.MockRestResponseCreators.withSuccess;

/**
 * Diffusion de l'information produit vers les systemes tiers.
 *
 * Ces tests affirmaient auparavant qu'une publication produisait un SUCCESS
 * immediat vers les trois systemes. Ils validaient en fait un mensonge : la
 * remise n'appelait personne, et rien n'etait lisible nulle part. Le statut
 * repose desormais sur un fait constate — un code de reponse HTTP en mode PUSH,
 * une lecture effective du flux en mode PULL — et les tests verifient ce fait.
 */
@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class IntegrationExportServiceTest {

    /** Fiche complete telle que le module du cycle de vie la transmet a la publication. */
    private static final String FICHE =
            "{\"offerId\":\"f1000000-0000-0000-0000-000000000001\",\"name\":\"Pack Convergent\","
                    + "\"status\":\"PUBLISHED\",\"promotionalPrice\":\"15000\",\"currency\":\"XOF\"}";

    private static final String CRM_URL = "https://crm.moov.bf/pim/offres";

    @Mock private IntegrationExportRepository exportRepository;
    @Mock private IntegrationEndpointRepository endpointRepository;

    private MockRestServiceServer httpServer;
    private IntegrationExportService exportService;

    @BeforeEach
    void setUp() {
        RestClient.Builder restClientBuilder = RestClient.builder();
        httpServer = MockRestServiceServer.bindTo(restClientBuilder).build();
        exportService = new IntegrationExportService(exportRepository, endpointRepository, restClientBuilder);

        // Aucun systeme n'est raccorde par defaut : c'est la situation reelle du
        // projet, ou ni le CRM ni le centre d'appel n'ont ete ouverts.
        when(endpointRepository.findById(any())).thenReturn(Optional.empty());
        when(exportRepository.findFirstByOfferIdAndTargetSystemOrderByCreatedAtDesc(any(), any()))
                .thenReturn(Optional.empty());
        when(exportRepository.save(any(IntegrationExport.class))).thenAnswer(inv -> {
            IntegrationExport e = inv.getArgument(0);
            if (e.getId() == null) {
                setField(e, "id", UUID.randomUUID());
            }
            return e;
        });
    }

    @Test
    void triggerAutoExport_shouldExportToAllTargetSystems() {
        exportService.triggerAutoExport(UUID.randomUUID(), FICHE);

        verify(exportRepository, times(TargetSystem.values().length)).save(any());
    }

    /**
     * Le corps de l'export valait la chaine « {} » avant correction : la plateforme
     * tracait des diffusions qui ne transportaient rien. La fiche transmise doit se
     * retrouver telle quelle dans chacun des exports produits.
     */
    @Test
    void triggerAutoExport_shouldCarryTheOfferFiche() {
        ArgumentCaptor<IntegrationExport> saved = ArgumentCaptor.forClass(IntegrationExport.class);

        exportService.triggerAutoExport(UUID.randomUUID(), FICHE);

        verify(exportRepository, times(TargetSystem.values().length)).save(saved.capture());
        for (IntegrationExport export : saved.getAllValues()) {
            assertEquals(FICHE, export.getPayload());
        }
    }

    /**
     * Aucun systeme n'etant raccorde, la fiche est mise a disposition sur le flux
     * et rien de plus. Elle ne doit surtout pas etre annoncee comme remise : c'est
     * exactement ce que faisait la version precedente, qui marquait SUCCESS sans
     * avoir appele personne.
     */
    @Test
    void triggerAutoExport_shouldStayPendingWhenNoSystemIsConnected() {
        ArgumentCaptor<IntegrationExport> saved = ArgumentCaptor.forClass(IntegrationExport.class);

        exportService.triggerAutoExport(UUID.randomUUID(), FICHE);

        verify(exportRepository, times(TargetSystem.values().length)).save(saved.capture());
        for (IntegrationExport export : saved.getAllValues()) {
            assertEquals(ExportStatus.PENDING, export.getStatus());
            assertEquals(DeliveryMode.PULL, export.getDeliveryMode());
            assertNull(export.getCompletedAt());
        }
    }

    /** Une fiche vide n'est pas une diffusion : elle doit partir en echec. */
    @Test
    void triggerAutoExport_shouldFailOnEmptyFiche() {
        ArgumentCaptor<IntegrationExport> saved = ArgumentCaptor.forClass(IntegrationExport.class);

        exportService.triggerAutoExport(UUID.randomUUID(), "{}");

        verify(exportRepository, times(TargetSystem.values().length)).save(saved.capture());
        for (IntegrationExport export : saved.getAllValues()) {
            assertEquals(ExportStatus.FAILED, export.getStatus());
            assertNotNull(export.getErrorMessage());
        }
    }

    @Test
    void triggerAutoExport_shouldSkipAFicheAlreadyDelivered() {
        IntegrationExport delivered = new IntegrationExport();
        delivered.setExportType(ExportType.AUTO_PUBLISH);
        delivered.setStatus(ExportStatus.SUCCESS);
        delivered.setPayload(FICHE);

        when(exportRepository.findFirstByOfferIdAndTargetSystemOrderByCreatedAtDesc(any(), any()))
                .thenReturn(Optional.of(delivered));

        exportService.triggerAutoExport(UUID.randomUUID(), FICHE);

        verify(exportRepository, never()).save(any());
    }

    /**
     * Une offre retiree puis remise en ligne doit repartir vers les systemes tiers.
     * Le controle d'idempotence portait sur l'existence d'un succes quelconque :
     * l'ancien succes suffisait a faire ignorer indefiniment la nouvelle mise en
     * ligne, et le CRM ne revoyait jamais l'offre.
     */
    @Test
    void triggerAutoExport_shouldRediffuseAfterAWithdrawal() {
        IntegrationExport withdrawal = new IntegrationExport();
        withdrawal.setExportType(ExportType.WITHDRAWAL);
        withdrawal.setStatus(ExportStatus.SUCCESS);
        withdrawal.setPayload("{\"state\":\"WITHDRAWN\"}");

        when(exportRepository.findFirstByOfferIdAndTargetSystemOrderByCreatedAtDesc(any(), any()))
                .thenReturn(Optional.of(withdrawal));

        exportService.triggerAutoExport(UUID.randomUUID(), FICHE);

        verify(exportRepository, times(TargetSystem.values().length)).save(any());
    }

    // ===================================================================
    // Remise effective vers un systeme raccorde
    // ===================================================================

    /**
     * Des qu'une URL est renseignee, la fiche part reellement et c'est la reponse
     * du destinataire qui fait foi.
     */
    @Test
    void triggerManualExport_shouldPushToAConnectedSystem() {
        UUID offerId = UUID.randomUUID();
        connectCrm();
        httpServer.expect(requestTo(CRM_URL))
                .andRespond(withSuccess("{\"received\":true}", MediaType.APPLICATION_JSON));

        IntegrationExport previous = new IntegrationExport();
        previous.setPayload(FICHE);
        when(exportRepository.findFirstByOfferIdAndPayloadIsNotNullOrderByCreatedAtDesc(offerId))
                .thenReturn(Optional.of(previous));

        IntegrationExportResponse response = exportService.triggerManualExport(
                offerId, TargetSystem.CRM, ExportType.MANUAL_EXPORT);

        httpServer.verify();
        assertEquals("SUCCESS", response.status());
        assertEquals("PUSH", response.deliveryMode());
        assertEquals(200, response.httpStatus());
        assertEquals(CRM_URL, response.endpointUrl());
    }

    /** Un systeme qui refuse la fiche ne l'a pas recue : l'export doit rester en echec. */
    @Test
    void triggerManualExport_shouldFailWhenTheTargetSystemRefuses() {
        UUID offerId = UUID.randomUUID();
        connectCrm();
        httpServer.expect(requestTo(CRM_URL)).andRespond(withServerError());

        IntegrationExport previous = new IntegrationExport();
        previous.setPayload(FICHE);
        when(exportRepository.findFirstByOfferIdAndPayloadIsNotNullOrderByCreatedAtDesc(offerId))
                .thenReturn(Optional.of(previous));

        IntegrationExportResponse response = exportService.triggerManualExport(
                offerId, TargetSystem.CRM, ExportType.MANUAL_EXPORT);

        assertEquals("FAILED", response.status());
        assertEquals(500, response.httpStatus());
        assertNotNull(response.errorMessage());
    }

    /** Sans raccordement, la rediffusion manuelle remet la fiche a disposition. */
    @Test
    void triggerManualExport_shouldResendTheLastFiche() {
        UUID offerId = UUID.randomUUID();
        IntegrationExport previous = new IntegrationExport();
        previous.setPayload(FICHE);

        when(exportRepository.findFirstByOfferIdAndPayloadIsNotNullOrderByCreatedAtDesc(offerId))
                .thenReturn(Optional.of(previous));

        IntegrationExportResponse response = exportService.triggerManualExport(
                offerId, TargetSystem.CRM, ExportType.MANUAL_EXPORT);

        assertEquals("CRM", response.targetSystem());
        assertEquals("PENDING", response.status());
        assertEquals("PULL", response.deliveryMode());
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

    // ===================================================================
    // Retrait d'une offre
    // ===================================================================

    /**
     * Le circuit ne diffusait que les mises en ligne : une offre retiree restait
     * proposee par le CRM et le centre d'appel, qui n'avaient aucun moyen de
     * l'apprendre.
     */
    @Test
    void triggerWithdrawal_shouldNotifyEveryTargetSystem() {
        UUID offerId = UUID.randomUUID();
        ArgumentCaptor<IntegrationExport> saved = ArgumentCaptor.forClass(IntegrationExport.class);

        exportService.triggerWithdrawal(offerId, "WITHDRAWN");

        verify(exportRepository, times(TargetSystem.values().length)).save(saved.capture());
        for (IntegrationExport export : saved.getAllValues()) {
            assertEquals(ExportType.WITHDRAWAL, export.getExportType());
            assertTrue(export.getPayload().contains("WITHDRAWN"));
            assertTrue(export.getPayload().contains(offerId.toString()));
        }
    }

    // ===================================================================
    // Reprise apres echec
    // ===================================================================

    @Test
    void retryFailedExports_shouldRetryTheDelivery() {
        IntegrationExport failed = failedExport(FICHE);

        when(exportRepository.findByStatusAndRetryCountLessThan(ExportStatus.FAILED, 3))
                .thenReturn(List.of(failed));

        exportService.retryFailedExports();

        assertEquals(ExportStatus.PENDING, failed.getStatus());
        assertEquals(2, failed.getRetryCount());
        verify(exportRepository).save(failed);
    }

    /** Une reprise vers un systeme raccorde qui repond doit aboutir a un succes. */
    @Test
    void retryFailedExports_shouldSucceedWhenTheTargetSystemAnswers() {
        connectCrm();
        httpServer.expect(requestTo(CRM_URL)).andRespond(withSuccess());

        IntegrationExport failed = failedExport(FICHE);
        failed.setTargetSystem(TargetSystem.CRM);

        when(exportRepository.findByStatusAndRetryCountLessThan(ExportStatus.FAILED, 3))
                .thenReturn(List.of(failed));

        exportService.retryFailedExports();

        httpServer.verify();
        assertEquals(ExportStatus.SUCCESS, failed.getStatus());
        assertEquals(DeliveryMode.PUSH, failed.getDeliveryMode());
    }

    /**
     * La reprise se contentait de basculer FAILED en SUCCESS sans rien retenter :
     * un export sans fiche se reparait tout seul au bout de cinq minutes. Il doit
     * rester en echec.
     */
    @Test
    void retryFailedExports_shouldStayFailedWhenTheFicheIsStillEmpty() {
        IntegrationExport failed = failedExport(null);

        when(exportRepository.findByStatusAndRetryCountLessThan(ExportStatus.FAILED, 3))
                .thenReturn(List.of(failed));

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
        // l'ecran appelant qui l'interprete comme jamais diffusee.
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

    // ===================================================================

    private void connectCrm() {
        IntegrationEndpoint endpoint = new IntegrationEndpoint();
        endpoint.setTargetSystem(TargetSystem.CRM);
        endpoint.setUrl(CRM_URL);
        endpoint.setActive(true);
        when(endpointRepository.findById(TargetSystem.CRM)).thenReturn(Optional.of(endpoint));
    }

    private static IntegrationExport failedExport(String payload) {
        IntegrationExport failed = new IntegrationExport();
        failed.setOfferId(UUID.randomUUID());
        failed.setTargetSystem(TargetSystem.WEBSITE);
        failed.setExportType(ExportType.AUTO_PUBLISH);
        failed.setPayload(payload);
        failed.setStatus(ExportStatus.FAILED);
        failed.setRetryCount(1);
        setField(failed, "id", UUID.randomUUID());
        return failed;
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
