package com.moov.pim.ai.api;

import com.moov.pim.ai.api.dto.AiAssistantRequest;
import com.moov.pim.ai.api.dto.AiAssistantResponse;
import com.moov.pim.ai.api.dto.AiGenerationRequest;
import com.moov.pim.ai.api.dto.AiGenerationResponse;
import com.moov.pim.ai.api.dto.AiInsightsResponse;
import com.moov.pim.ai.service.AiAssistantService;
import com.moov.pim.ai.api.dto.SheetExtractionRequest;
import com.moov.pim.ai.api.dto.SheetExtractionResponse;
import com.moov.pim.ai.service.CatalogAnalysisService;
import com.moov.pim.ai.service.TechnicalSheetExtractionService;
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
    private final TechnicalSheetExtractionService sheetExtractionService;

    public AiController(CatalogAnalysisService catalogAnalysisService,
                        AiAssistantService assistantService,
                        ContentGenerationService contentGenerationService,
                        TechnicalSheetExtractionService sheetExtractionService) {
        this.catalogAnalysisService = catalogAnalysisService;
        this.assistantService = assistantService;
        this.contentGenerationService = contentGenerationService;
        this.sheetExtractionService = sheetExtractionService;
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

    /**
     * Classification intelligente : lecture d'une fiche technique.
     *
     * Reservee a CATALOG_MANAGE, la permission du chef de produit : le cahier des
     * charges (7.10) situe l'auto-tagging « cote chef de produit, a la creation du
     * produit/offre », quand la generation de contenu marketing releve de
     * l'analyste pendant l'enrichissement. Ouvrir cette route en lecture seule
     * l'aurait proposee a des roles qui n'ont rien a creer.
     *
     * La reponse est une proposition a relire, jamais une creation : l'element
     * n'entre au catalogue que lorsque le chef de produit valide le formulaire.
     */
    @PostMapping("/extract")
    @PreAuthorize("hasAuthority('CATALOG_MANAGE')")
    public ResponseEntity<SheetExtractionResponse> extract(@Valid @RequestBody SheetExtractionRequest request) {
        return ResponseEntity.ok(sheetExtractionService.extract(request));
    }
}
