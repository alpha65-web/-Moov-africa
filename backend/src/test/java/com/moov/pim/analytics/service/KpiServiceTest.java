package com.moov.pim.analytics.service;

import com.moov.pim.analytics.domain.KpiEvent;
import com.moov.pim.analytics.repository.KpiEventRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.lang.reflect.Field;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class KpiServiceTest {

    @Mock private KpiEventRepository kpiEventRepository;

    @InjectMocks private KpiService kpiService;

    @Test
    void record_shouldSaveKpiEvent() {
        UUID offerId = UUID.randomUUID();
        UUID actorId = UUID.randomUUID();

        when(kpiEventRepository.save(any(KpiEvent.class))).thenAnswer(inv -> {
            KpiEvent e = inv.getArgument(0);
            setField(e, "id", UUID.randomUUID());
            return e;
        });

        KpiEvent result = kpiService.record(offerId, "OFFER_VIEWED", actorId, 1500L);

        assertNotNull(result);
        assertEquals(offerId, result.getOfferId());
        assertEquals("OFFER_VIEWED", result.getEventType());
        assertEquals(actorId, result.getActorId());
        assertEquals(1500L, result.getDurationMs());
        verify(kpiEventRepository).save(any());
    }

    @Test
    void record_shouldSaveWithNullDuration() {
        UUID offerId = UUID.randomUUID();
        UUID actorId = UUID.randomUUID();

        when(kpiEventRepository.save(any(KpiEvent.class))).thenAnswer(inv -> {
            KpiEvent e = inv.getArgument(0);
            setField(e, "id", UUID.randomUUID());
            return e;
        });

        KpiEvent result = kpiService.record(offerId, "OFFER_CREATED", actorId, null);

        assertNotNull(result);
        assertNull(result.getDurationMs());
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
