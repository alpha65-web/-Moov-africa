package com.moov.pim.analytics.api;

import com.moov.pim.analytics.service.KpiService;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.PageRequest;
import org.springframework.http.HttpStatus;

import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class KpiControllerTest {

    @Mock private KpiService kpiService;
    @InjectMocks private KpiController controller;

    @Test
    void byOffer_shouldReturn200() {
        UUID offerId = UUID.randomUUID();
        var pageable = PageRequest.of(0, 10);
        when(kpiService.getByOffer(offerId, pageable)).thenReturn(new PageImpl<>(List.of()));

        var result = controller.byOffer(offerId, pageable);

        assertEquals(HttpStatus.OK, result.getStatusCode());
    }

    @Test
    void byPeriod_shouldReturn200() {
        var from = LocalDateTime.of(2026, 1, 1, 0, 0);
        var to = LocalDateTime.of(2026, 12, 31, 23, 59);
        var pageable = PageRequest.of(0, 10);
        when(kpiService.getByPeriod(from, to, pageable)).thenReturn(new PageImpl<>(List.of()));

        var result = controller.byPeriod(from, to, pageable);

        assertEquals(HttpStatus.OK, result.getStatusCode());
    }
}
