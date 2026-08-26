package com.moov.pim.analytics.api;

import com.moov.pim.analytics.api.dto.KpiEventResponse;
import com.moov.pim.analytics.api.dto.KpiSummaryResponse;
import com.moov.pim.analytics.service.KpiService;
import com.moov.pim.analytics.service.KpiSummaryService;
import com.moov.pim.permissions.security.CustomUserDetails;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
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
    private final KpiSummaryService kpiSummaryService;

    public KpiController(KpiService kpiService, KpiSummaryService kpiSummaryService) {
        this.kpiService = kpiService;
        this.kpiSummaryService = kpiSummaryService;
    }

    /**
     * Indicateurs agreges : Time To Market, temps par etape, goulot d'etranglement.
     *
     * Le perimetre depend de la permission et non d'un parametre de requete : un
     * compte qui ne detient pas ANALYTICS_TEAM_VIEW ne recoit que son propre temps
     * de traitement, conformement au cahier des charges qui reserve la productivite
     * des equipes au chef de service et au chef de departement.
     */
    @GetMapping("/summary")
    @PreAuthorize("hasAuthority('ANALYTICS_VIEW')")
    public ResponseEntity<KpiSummaryResponse> summary(
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) LocalDateTime from,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) LocalDateTime to,
            @AuthenticationPrincipal CustomUserDetails principal) {

        boolean teamScope = principal.getAuthorities().stream()
                .anyMatch(authority -> "ANALYTICS_TEAM_VIEW".equals(authority.getAuthority()));

        return ResponseEntity.ok(
                kpiSummaryService.summarize(from, to, teamScope, principal.getUserId()));
    }

    @GetMapping("/offers/{offerId}")
    @PreAuthorize("hasAuthority('ANALYTICS_VIEW')")
    public ResponseEntity<Page<KpiEventResponse>> byOffer(@PathVariable UUID offerId, Pageable pageable) {
        return ResponseEntity.ok(kpiService.getByOffer(offerId, pageable));
    }

    /**
     * Flux des evenements de la periode, borne au meme perimetre que la synthese.
     *
     * Le cloisonnement TEAM/SELF n'etait applique qu'a /kpi/summary : ce flux-ci
     * renvoyait l'activite de tout le monde a quiconque detenait ANALYTICS_VIEW.
     * L'ecran affichait donc, sous un bloc annoncant « votre temps de traitement »,
     * un tableau et quatre compteurs portant sur l'equipe entiere.
     */
    @GetMapping
    @PreAuthorize("hasAuthority('ANALYTICS_VIEW')")
    public ResponseEntity<Page<KpiEventResponse>> byPeriod(
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) LocalDateTime from,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) LocalDateTime to,
            @AuthenticationPrincipal CustomUserDetails principal,
            Pageable pageable) {

        boolean teamScope = principal.getAuthorities().stream()
                .anyMatch(authority -> "ANALYTICS_TEAM_VIEW".equals(authority.getAuthority()));

        return ResponseEntity.ok(
                kpiService.getByPeriod(from, to, teamScope, principal.getUserId(), pageable));
    }
}
