package com.moov.pim.ai.api;

import com.moov.pim.ai.api.dto.AiUsageStats;
import com.moov.pim.ai.api.dto.ChatMessageResponse;
import com.moov.pim.ai.api.dto.ChatRequest;
import com.moov.pim.ai.api.dto.GenerateContentRequest;
import com.moov.pim.ai.api.dto.GeneratedContent;
import com.moov.pim.ai.api.dto.PricingSuggestion;
import com.moov.pim.ai.api.dto.TranslationRequest;
import com.moov.pim.ai.api.dto.TranslationResult;
import com.moov.pim.ai.domain.AnomalyReport;
import com.moov.pim.ai.domain.QualityReport;
import com.moov.pim.ai.service.AiService;
import com.moov.pim.permissions.security.CustomUserDetails;
import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/ai")
public class AiController {

    private final AiService aiService;

    public AiController(AiService aiService) {
        this.aiService = aiService;
    }

    @PostMapping("/generate-content")
    @PreAuthorize("hasAnyAuthority('OFFER_CREATE', 'OFFER_EDIT')")
    public ResponseEntity<GeneratedContent> generateContent(
            @Valid @RequestBody GenerateContentRequest request,
            @AuthenticationPrincipal CustomUserDetails principal) {
        GeneratedContent content = aiService.generateContent(
            request.offerId(), request.tone(), request.targetAudience(),
            request.language(), principal.getUserId());
        return ResponseEntity.ok(content);
    }

    @PostMapping("/quality-score/{offerId}")
    @PreAuthorize("hasAnyAuthority('OFFER_CREATE', 'OFFER_EDIT', 'OFFER_VALIDATE')")
    public ResponseEntity<QualityReport> analyzeQuality(
            @PathVariable UUID offerId,
            @AuthenticationPrincipal CustomUserDetails principal) {
        QualityReport report = aiService.analyzeQuality(offerId, principal.getUserId());
        return ResponseEntity.ok(report);
    }

    @PostMapping("/suggest-pricing/{offerId}")
    @PreAuthorize("hasAnyAuthority('OFFER_CREATE', 'OFFER_EDIT')")
    public ResponseEntity<PricingSuggestion> suggestPricing(
            @PathVariable UUID offerId,
            @AuthenticationPrincipal CustomUserDetails principal) {
        PricingSuggestion suggestion = aiService.suggestPricing(offerId, principal.getUserId());
        return ResponseEntity.ok(suggestion);
    }

    @PostMapping("/translate")
    @PreAuthorize("hasAnyAuthority('OFFER_CREATE', 'OFFER_EDIT')")
    public ResponseEntity<TranslationResult> translate(
            @Valid @RequestBody TranslationRequest request,
            @AuthenticationPrincipal CustomUserDetails principal) {
        TranslationResult result = aiService.translate(
            request.offerId(), request.targetLanguage(), principal.getUserId());
        return ResponseEntity.ok(result);
    }

    @PostMapping("/detect-anomalies")
    @PreAuthorize("hasAnyAuthority('OFFER_VALIDATE', 'USER_MANAGE')")
    public ResponseEntity<AnomalyReport> detectAnomalies(
            @AuthenticationPrincipal CustomUserDetails principal) {
        AnomalyReport report = aiService.detectAnomalies(principal.getUserId());
        return ResponseEntity.ok(report);
    }

    @GetMapping("/usage")
    @PreAuthorize("hasAuthority('USER_MANAGE')")
    public ResponseEntity<AiUsageStats> getUsageStats(
            @RequestParam(defaultValue = "30") int days) {
        AiUsageStats stats = aiService.getUsageStats(days);
        return ResponseEntity.ok(stats);
    }

    @PostMapping("/chat")
    public ResponseEntity<ChatMessageResponse> chat(
            @Valid @RequestBody ChatRequest request,
            @AuthenticationPrincipal CustomUserDetails principal) {
        ChatMessageResponse response = aiService.chat(request.message(), principal.getUserId());
        return ResponseEntity.ok(response);
    }

    @GetMapping("/chat/history")
    public ResponseEntity<List<ChatMessageResponse>> chatHistory(
            @AuthenticationPrincipal CustomUserDetails principal) {
        return ResponseEntity.ok(aiService.getChatHistory(principal.getUserId()));
    }

    @DeleteMapping("/chat/history")
    public ResponseEntity<Void> clearChatHistory(
            @AuthenticationPrincipal CustomUserDetails principal) {
        aiService.clearChatHistory(principal.getUserId());
        return ResponseEntity.noContent().build();
    }
}
