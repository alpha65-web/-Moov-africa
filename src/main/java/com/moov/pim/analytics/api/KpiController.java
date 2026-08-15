package com.moov.pim.analytics.api;

import com.moov.pim.analytics.domain.KpiEvent;
import com.moov.pim.analytics.service.KpiService;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.time.LocalDateTime;
import java.util.List;
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
    public ResponseEntity<List<KpiEvent>> byOffer(@PathVariable UUID offerId) {
        return ResponseEntity.ok(kpiService.getByOffer(offerId));
    }

    @GetMapping
    @PreAuthorize("hasAuthority('ANALYTICS_VIEW')")
    public ResponseEntity<List<KpiEvent>> byPeriod(
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) LocalDateTime from,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) LocalDateTime to) {
        return ResponseEntity.ok(kpiService.getByPeriod(from, to));
    }
}
