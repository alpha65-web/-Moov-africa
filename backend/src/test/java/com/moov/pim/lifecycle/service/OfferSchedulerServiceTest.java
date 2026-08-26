package com.moov.pim.lifecycle.service;

import com.moov.pim.lifecycle.domain.Offer;
import com.moov.pim.lifecycle.domain.OfferStatus;
import com.moov.pim.lifecycle.repository.OfferRepository;
import com.moov.pim.shared.event.OfferExpiringEvent;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.context.ApplicationEventPublisher;

import java.lang.reflect.Field;
import java.time.LocalDateTime;
import java.util.Collections;
import java.util.List;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;

/**
 * Le planificateur ecrivait auparavant le statut directement sur l'entite. Une
 * offre publiee a son echeance n'etait donc ni historisee, ni versionnee, et
 * n'emettait aucun evenement : ni notification, ni indicateur, ni diffusion vers
 * les systemes tiers. Ces tests verifient desormais que le planificateur delegue
 * au meme chemin que les transitions declenchees par un acteur, plutot que de
 * verifier qu'il modifie le statut lui-meme.
 */
@ExtendWith(MockitoExtension.class)
class OfferSchedulerServiceTest {

    @Mock private OfferRepository offerRepository;
    @Mock private com.moov.pim.catalog.repository.CategoryRepository categoryRepository;
    @Mock private OfferService offerService;
    @Mock private ApplicationEventPublisher eventPublisher;

    @InjectMocks private OfferSchedulerService schedulerService;

    @Test
    void publishPlannedOffers_shouldGoThroughTheNormalTransitionPath() {
        Offer offer = createOffer("Offre Planifiée", OfferStatus.PLANNED);
        offer.setValidFrom(LocalDateTime.now().minusHours(1));

        when(offerRepository.findPlannedReadyToPublish(any())).thenReturn(List.of(offer));

        schedulerService.publishPlannedOffers();

        // Le planificateur ne touche plus au statut : il demande la transition, qui
        // seule declenche historique, version, notification et diffusion.
        verify(offerService).applyScheduledTransition(eq(offer), eq(OfferStatus.PUBLISHED), any());
        verify(offerRepository, never()).save(any());
    }

    /**
     * Une offre en echec ne doit pas empecher les suivantes de partir : sans ce
     * comportement, une seule fiche mal formee bloquait toute la vague de
     * publications planifiees de la minute.
     */
    @Test
    void publishPlannedOffers_shouldContinueAfterAFailingOffer() {
        Offer enEchec = createOffer("Offre en échec", OfferStatus.PLANNED);
        Offer suivante = createOffer("Offre suivante", OfferStatus.PLANNED);

        when(offerRepository.findPlannedReadyToPublish(any())).thenReturn(List.of(enEchec, suivante));
        doThrow(new IllegalStateException("transition impossible"))
                .when(offerService).applyScheduledTransition(eq(enEchec), any(), any());

        schedulerService.publishPlannedOffers();

        verify(offerService).applyScheduledTransition(eq(suivante), eq(OfferStatus.PUBLISHED), any());
    }

    @Test
    void publishPlannedOffers_shouldDoNothingIfNoneReady() {
        when(offerRepository.findPlannedReadyToPublish(any())).thenReturn(Collections.emptyList());

        schedulerService.publishPlannedOffers();

        verify(offerService, never()).applyScheduledTransition(any(), any(), any());
    }

    @Test
    void expireOffers_shouldGoThroughTheNormalTransitionPath() {
        Offer offer = createOffer("Offre Expirée", OfferStatus.PUBLISHED);
        offer.setValidUntil(LocalDateTime.now().minusDays(1));

        when(offerRepository.findExpiredOffers(any())).thenReturn(List.of(offer));

        schedulerService.expireOffers();

        verify(offerService).applyScheduledTransition(eq(offer), eq(OfferStatus.OBSOLETE), any());
        verify(offerRepository, never()).save(any());
    }

    @Test
    void expireOffers_shouldDoNothingIfNoneExpired() {
        when(offerRepository.findExpiredOffers(any())).thenReturn(Collections.emptyList());

        schedulerService.expireOffers();

        verify(offerService, never()).applyScheduledTransition(any(), any(), any());
    }

    /**
     * L'alerte n'existait que sous forme de ligne dans le journal technique du
     * serveur : elle doit atteindre l'auteur de la fiche.
     */
    @Test
    void alertExpiringOffers_shouldWarnTheOfferAuthor() {
        Offer offer = createOffer("Offre bientôt expirée", OfferStatus.PUBLISHED);
        offer.setValidUntil(LocalDateTime.now().plusDays(3));

        when(offerRepository.findExpiringOffers(any(), any())).thenReturn(List.of(offer));

        schedulerService.alertExpiringOffers();

        verify(eventPublisher).publishEvent(any(OfferExpiringEvent.class));
    }

    @Test
    void alertExpiringOffers_shouldWarnNobodyWhenNothingExpires() {
        when(offerRepository.findExpiringOffers(any(), any())).thenReturn(Collections.emptyList());

        schedulerService.alertExpiringOffers();

        verify(eventPublisher, never()).publishEvent(any(OfferExpiringEvent.class));
    }

    private Offer createOffer(String name, OfferStatus status) {
        Offer offer = new Offer();
        offer.setName(name);
        offer.setStatus(status);
        offer.setCreatedById(UUID.randomUUID());
        setField(Offer.class, offer, "id", UUID.randomUUID());
        return offer;
    }

    private static void setField(Class<?> clazz, Object target, String fieldName, Object value) {
        try {
            Field field = clazz.getDeclaredField(fieldName);
            field.setAccessible(true);
            field.set(target, value);
        } catch (Exception e) {
            throw new RuntimeException(e);
        }
    }
}
