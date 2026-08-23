package com.moov.pim.ai.api;

import com.moov.pim.ai.api.dto.AiAssistantRequest;
import com.moov.pim.ai.api.dto.AiAssistantResponse;
import com.moov.pim.ai.api.dto.AiGenerationRequest;
import com.moov.pim.ai.api.dto.AiGenerationResponse;
import com.moov.pim.ai.api.dto.AiInsightsResponse;
import com.moov.pim.ai.service.AiAssistantService;
import com.moov.pim.ai.service.CatalogAnalysisService;
import com.moov.pim.ai.service.ContentGenerationService;
import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * Assistance au pilotage du referentiel.
 *
 * Les trois endpoints s'appuient exclusivement sur les donnees de la base : aucun
 * service externe n'est appele et aucune valeur n'est simulee.
 */
@RestController
@RequestMapping("/ai")
public class AiController {

    private final CatalogAnalysisService catalogAnalysisService;
    private final AiAssistantService assistantService;
    private final ContentGenerationService contentGenerationService;

    public AiController(CatalogAnalysisService catalogAnalysisService,
                        AiAssistantService assistantService,
                        ContentGenerationService contentGenerationService) {
        this.catalogAnalysisService = catalogAnalysisService;
        this.assistantService = assistantService;
        this.contentGenerationService = contentGenerationService;
    }

    /** Score qualite, anomalies et recommandations calcules sur l'etat courant. */
    @GetMapping("/insights")
    @PreAuthorize("hasAuthority('CATALOG_READ')")
    public ResponseEntity<AiInsightsResponse> insights() {
        return ResponseEntity.ok(catalogAnalysisService.analyse());
    }

    /** Reponse chiffree a une question portant sur le referentiel. */
    @PostMapping("/assistant")
    @PreAuthorize("hasAuthority('CATALOG_READ')")
    public ResponseEntity<AiAssistantResponse> assistant(@Valid @RequestBody AiAssistantRequest request) {
        return ResponseEntity.ok(assistantService.answer(request.question()));
    }

    /** Generation de description, de mots-cles ou de traduction a partir d'un element reel. */
    @PostMapping("/generate")
    @PreAuthorize("hasAuthority('CATALOG_READ')")
    public ResponseEntity<AiGenerationResponse> generate(@Valid @RequestBody AiGenerationRequest request) {
        return ResponseEntity.ok(contentGenerationService.generate(request));
    }
}
