package com.moov.pim.analytics.api;

import com.moov.pim.analytics.api.dto.KpiEventResponse;
import com.moov.pim.analytics.service.KpiService;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.time.LocalDateTime;
import java.util.UUID;

@RestController
@RequestMapping("/kpi")
public class KpiController {

    private final KpiService kpiService;

    public KpiController(KpiService kpiService) {
        this.kpiService = kpiService;
    }

    @GetMapping("/offers/{offerId}")
    @PreAuthorize("hasAuthority('ANALYTICS_VIEW')")
    public ResponseEntity<Page<KpiEventResponse>> byOffer(@PathVariable UUID offerId, Pageable pageable) {
        return ResponseEntity.ok(kpiService.getByOffer(offerId, pageable));
    }

    @GetMapping
    @PreAuthorize("hasAuthority('ANALYTICS_VIEW')")
    public ResponseEntity<Page<KpiEventResponse>> byPeriod(
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) LocalDateTime from,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) LocalDateTime to,
            Pageable pageable) {
        return ResponseEntity.ok(kpiService.getByPeriod(from, to, pageable));
    }
}
