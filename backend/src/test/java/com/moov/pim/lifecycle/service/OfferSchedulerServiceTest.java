package com.moov.pim.lifecycle.service;

import com.moov.pim.lifecycle.domain.Offer;
import com.moov.pim.lifecycle.domain.OfferStatus;
import com.moov.pim.lifecycle.repository.OfferRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.lang.reflect.Field;
import java.time.LocalDateTime;
import java.util.Collections;
import java.util.List;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class OfferSchedulerServiceTest {

    @Mock private OfferRepository offerRepository;

    @InjectMocks private OfferSchedulerService schedulerService;

    @Test
    void publishPlannedOffers_shouldPublishReadyOffers() {
        Offer offer = createOffer("Offre Planifiée", OfferStatus.PLANNED);
        offer.setValidFrom(LocalDateTime.now().minusHours(1));

        when(offerRepository.findPlannedReadyToPublish(any())).thenReturn(List.of(offer));
        when(offerRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));

        schedulerService.publishPlannedOffers();

        assertEquals(OfferStatus.PUBLISHED, offer.getStatus());
        assertNotNull(offer.getPublishDate());
        verify(offerRepository).save(offer);
    }

    @Test
    void publishPlannedOffers_shouldDoNothingIfNoneReady() {
        when(offerRepository.findPlannedReadyToPublish(any())).thenReturn(Collections.emptyList());

        schedulerService.publishPlannedOffers();

        verify(offerRepository, never()).save(any());
    }

    @Test
    void expireOffers_shouldSetObsoleteStatus() {
        Offer offer = createOffer("Offre Expirée", OfferStatus.PUBLISHED);
        offer.setValidUntil(LocalDateTime.now().minusDays(1));

        when(offerRepository.findExpiredOffers(any())).thenReturn(List.of(offer));
        when(offerRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));

        schedulerService.expireOffers();

        assertEquals(OfferStatus.OBSOLETE, offer.getStatus());
        verify(offerRepository).save(offer);
    }

    @Test
    void expireOffers_shouldDoNothingIfNoneExpired() {
        when(offerRepository.findExpiredOffers(any())).thenReturn(Collections.emptyList());

        schedulerService.expireOffers();

        verify(offerRepository, never()).save(any());
    }

    @Test
    void alertExpiringOffers_shouldQueryExpiringOffers() {
        when(offerRepository.findExpiringOffers(any(), any())).thenReturn(Collections.emptyList());

        schedulerService.alertExpiringOffers();

        verify(offerRepository).findExpiringOffers(any(), any());
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
