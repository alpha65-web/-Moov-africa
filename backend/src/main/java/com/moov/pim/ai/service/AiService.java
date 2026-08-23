package com.moov.pim.ai.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.moov.pim.ai.api.dto.AiUsageStats;
import com.moov.pim.ai.api.dto.ChatMessageResponse;
import com.moov.pim.ai.api.dto.GeneratedContent;
import com.moov.pim.ai.api.dto.PricingSuggestion;
import com.moov.pim.ai.api.dto.TranslationResult;
import com.moov.pim.ai.domain.AiChatMessage;
import com.moov.pim.ai.domain.AiTask;
import com.moov.pim.ai.domain.AiUsageLog;
import com.moov.pim.ai.domain.AnomalyReport;
import com.moov.pim.ai.domain.QualityReport;
import com.moov.pim.ai.repository.AiChatRepository;
import com.moov.pim.ai.repository.AiUsageLogRepository;
import com.moov.pim.catalog.repository.CatalogItemRepository;
import com.moov.pim.lifecycle.domain.Offer;
import com.moov.pim.lifecycle.repository.OfferRepository;
import com.moov.pim.shared.event.AiTaskCompletedEvent;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.Collections;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@Service
public class AiService {

    private static final Logger log = LoggerFactory.getLogger(AiService.class);

    private final AnthropicClient anthropicClient;
    private final OfferRepository offerRepository;
    private final CatalogItemRepository catalogItemRepository;
    private final AiUsageLogRepository usageLogRepository;
    private final AiChatRepository chatRepository;
    private final ObjectMapper objectMapper;
    private final ApplicationEventPublisher eventPublisher;

    @Value("${pim.ai.daily-limit-per-user:50}")
    private int dailyLimitPerUser;

    @Value("${pim.ai.model:claude-sonnet-4-20250514}")
    private String modelId;

    public AiService(AnthropicClient anthropicClient,
                     OfferRepository offerRepository,
                     CatalogItemRepository catalogItemRepository,
                     AiUsageLogRepository usageLogRepository,
                     AiChatRepository chatRepository,
                     ObjectMapper objectMapper,
                     ApplicationEventPublisher eventPublisher) {
        this.anthropicClient = anthropicClient;
        this.offerRepository = offerRepository;
        this.catalogItemRepository = catalogItemRepository;
        this.usageLogRepository = usageLogRepository;
        this.chatRepository = chatRepository;
        this.objectMapper = objectMapper;
        this.eventPublisher = eventPublisher;
    }

    @Transactional
    public GeneratedContent generateContent(UUID offerId, String tone, String targetAudience, String language, UUID userId) {
        checkDailyLimit(userId);
        Offer offer = findOffer(offerId);

        String systemPrompt = """
            Tu es un expert en marketing telecom pour Moov Africa au Burkina Faso.
            Tu generes du contenu commercial pour les offres mobiles (voix, data, SMS, mobile money).
            Le contenu doit etre adapte au marche ouest-africain et en %s.
            Ton : %s. Public cible : %s.

            IMPORTANT : Reponds UNIQUEMENT en JSON valide avec cette structure exacte :
            {
              "shortDescription": "max 160 caracteres, accrocheuse",
              "longDescription": "2-3 paragraphes detailles",
              "seoTitle": "max 60 caracteres, optimise SEO",
              "seoDescription": "max 155 caracteres, meta description",
              "legalMentions": "mentions legales conformes ARCEP/BF",
              "marketingSlogan": "slogan court et percutant"
            }
            """.formatted(language.equals("fr") ? "francais" : language, tone, targetAudience != null ? targetAudience : "grand public");

        String userPrompt = buildOfferContext(offer);

        return callAi(systemPrompt, userPrompt, GeneratedContent.class, AiTask.GENERATE_DESCRIPTION, userId, "OFFER", offerId);
    }

    @Transactional
    public QualityReport analyzeQuality(UUID offerId, UUID userId) {
        checkDailyLimit(userId);
        Offer offer = findOffer(offerId);

        String systemPrompt = """
            Tu es un auditeur qualite pour un PIM telecom (Moov Africa, Burkina Faso).
            Evalue la qualite d'une fiche offre sur ces criteres :

            1. Completude (0-20) : tous les champs obligatoires remplis ?
            2. Description (0-20) : clarte, longueur adequate, absence de fautes
            3. SEO (0-15) : titre et meta optimises, mots-cles pertinents
            4. Prix (0-15) : coherent avec le marche, mention devise
            5. Legal (0-15) : mentions legales presentes et conformes ARCEP
            6. Segmentation (0-15) : cible definie, segment adapte

            IMPORTANT : Reponds UNIQUEMENT en JSON valide :
            {
              "overallScore": 0-100,
              "grade": "A/B/C/D/F",
              "criteria": [
                {"name": "Completude", "score": 0, "maxScore": 20, "feedback": "..."},
                ...
              ],
              "suggestions": ["suggestion 1", "suggestion 2", ...]
            }
            """;

        String userPrompt = buildOfferContext(offer);

        return callAi(systemPrompt, userPrompt, QualityReport.class, AiTask.QUALITY_SCORE, userId, "OFFER", offerId);
    }

    @Transactional
    public PricingSuggestion suggestPricing(UUID offerId, UUID userId) {
        checkDailyLimit(userId);
        Offer offer = findOffer(offerId);

        String systemPrompt = """
            Tu es un analyste pricing telecom pour Moov Africa au Burkina Faso.
            Devise : XOF (Franc CFA). Marche : Afrique de l'Ouest.
            Concurrents principaux : Orange BF, Telecel Faso.

            Analyse l'offre et propose une strategie tarifaire.

            IMPORTANT : Reponds UNIQUEMENT en JSON valide :
            {
              "suggestedPrice": 0,
              "minPrice": 0,
              "maxPrice": 0,
              "currency": "XOF",
              "rationale": "explication detaillee de la logique tarifaire",
              "pricePoints": [
                {"label": "Economique", "price": 0, "description": "..."},
                {"label": "Standard", "price": 0, "description": "..."},
                {"label": "Premium", "price": 0, "description": "..."}
              ]
            }
            """;

        String userPrompt = buildOfferContext(offer);

        return callAi(systemPrompt, userPrompt, PricingSuggestion.class, AiTask.SUGGEST_PRICING, userId, "OFFER", offerId);
    }

    @Transactional
    public TranslationResult translate(UUID offerId, String targetLanguage, UUID userId) {
        checkDailyLimit(userId);
        Offer offer = findOffer(offerId);

        String systemPrompt = """
            Tu es un traducteur professionnel specialise dans les telecoms en Afrique de l'Ouest.
            Traduis le contenu de l'offre en %s tout en conservant le ton commercial.
            Adapte les expressions au contexte culturel local.

            IMPORTANT : Reponds UNIQUEMENT en JSON valide :
            {
              "sourceLanguage": "fr",
              "targetLanguage": "%s",
              "translatedName": "...",
              "translatedShortDescription": "...",
              "translatedLongDescription": "...",
              "translatedSeoTitle": "...",
              "translatedSeoDescription": "..."
            }
            """.formatted(targetLanguage, targetLanguage);

        String userPrompt = buildOfferContext(offer);

        return callAi(systemPrompt, userPrompt, TranslationResult.class, AiTask.TRANSLATE, userId, "OFFER", offerId);
    }

    @Transactional
    public AnomalyReport detectAnomalies(UUID userId) {
        checkDailyLimit(userId);

        List<Offer> offers = offerRepository.findAll();

        String systemPrompt = """
            Tu es un systeme de detection d'anomalies pour un PIM telecom (Moov Africa).
            Analyse les offres et detecte :
            - Prix aberrants (trop bas ou trop eleves pour le marche XOF)
            - Descriptions manquantes ou trop courtes
            - Offres expirees mais encore actives
            - Doublons potentiels (noms similaires)
            - Incoherences entre statut et contenu
            - Offres sans segment cible

            IMPORTANT : Reponds UNIQUEMENT en JSON valide :
            {
              "totalChecked": 0,
              "anomalyCount": 0,
              "anomalies": [
                {
                  "entityId": "uuid",
                  "entityName": "nom",
                  "type": "PRIX_ABERRANT|DESCRIPTION_MANQUANTE|OFFRE_EXPIREE|DOUBLON|INCOHERENCE|SANS_SEGMENT",
                  "severity": "CRITICAL|HIGH|MEDIUM|LOW",
                  "description": "...",
                  "recommendation": "..."
                }
              ]
            }
            """;

        StringBuilder sb = new StringBuilder("Liste des offres a analyser :\n\n");
        for (Offer o : offers) {
            sb.append("---\nID: ").append(o.getId())
              .append("\nNom: ").append(o.getName())
              .append("\nStatut: ").append(o.getStatus())
              .append("\nDescription courte: ").append(o.getShortDescription() != null ? o.getShortDescription() : "(vide)")
              .append("\nDescription longue: ").append(o.getLongDescription() != null ? truncate(o.getLongDescription(), 200) : "(vide)")
              .append("\nPrix promo: ").append(o.getPromotionalPrice() != null ? o.getPromotionalPrice() + " " + o.getCurrency() : "(non defini)")
              .append("\nSegment: ").append(o.getTargetSegment() != null ? o.getTargetSegment() : "(non defini)")
              .append("\nValide du: ").append(o.getValidFrom() != null ? o.getValidFrom() : "(non defini)")
              .append(" au: ").append(o.getValidUntil() != null ? o.getValidUntil() : "(non defini)")
              .append("\n");
        }

        return callAi(systemPrompt, sb.toString(), AnomalyReport.class, AiTask.DETECT_ANOMALIES, userId, null, null);
    }

    @Transactional(readOnly = true)
    public AiUsageStats getUsageStats(int days) {
        LocalDateTime since = LocalDateTime.now().minusDays(days);

        long total = usageLogRepository.count();
        long failed = usageLogRepository.count() - usageLogRepository.countByUserIdAndSuccess(null, true);

        Long inputTokens = usageLogRepository.sumInputTokensSince(since);
        Long outputTokens = usageLogRepository.sumOutputTokensSince(since);
        Double avgLatency = usageLogRepository.avgLatencyMsSince(since);

        List<Object[]> byTask = usageLogRepository.countByTaskSince(since);
        Map<String, Long> taskMap = new LinkedHashMap<>();
        for (Object[] row : byTask) {
            taskMap.put(row[0].toString(), (Long) row[1]);
        }

        List<Object[]> byDay = usageLogRepository.countByDaySince(since);
        Map<String, Long> dayMap = new LinkedHashMap<>();
        for (Object[] row : byDay) {
            dayMap.put(row[0].toString(), (Long) row[1]);
        }

        return new AiUsageStats(
            total, total - failed, failed,
            inputTokens != null ? inputTokens : 0,
            outputTokens != null ? outputTokens : 0,
            avgLatency != null ? avgLatency : 0,
            taskMap, dayMap
        );
    }

    @Transactional
    public ChatMessageResponse chat(String userMessage, UUID userId) {
        checkDailyLimit(userId);

        AiChatMessage userMsg = new AiChatMessage();
        userMsg.setUserId(userId);
        userMsg.setRole("user");
        userMsg.setContent(userMessage);
        chatRepository.save(userMsg);

        List<AiChatMessage> history = chatRepository.findTop50ByUserIdOrderByCreatedAtDesc(userId);
        Collections.reverse(history);

        List<Map<String, String>> messages = history.stream()
                .map(m -> Map.of("role", m.getRole(), "content", m.getContent()))
                .toList();

        String systemPrompt = """
            Tu es l'assistant IA de Moov Africa PIM, un systeme de gestion des offres telecom au Burkina Faso.
            Tu aides les equipes avec :
            - La creation et l'optimisation des offres mobiles (voix, data, SMS, mobile money)
            - L'analyse du marche telecom ouest-africain
            - Les strategies marketing et pricing
            - Les questions sur le catalogue produits et les campagnes
            - La conformite reglementaire (ARCEP Burkina Faso)

            Sois professionnel, concis et adapte au contexte du marche africain.
            Reponds en francais par defaut sauf si l'utilisateur ecrit dans une autre langue.
            """;

        AnthropicClient.Response response = anthropicClient.callChat(systemPrompt, messages);

        AiUsageLog usageLog = new AiUsageLog();
        usageLog.setTask(AiTask.CHAT);
        usageLog.setUserId(userId);
        usageLog.setModel(modelId);
        usageLog.setInputTokens(response.inputTokens());
        usageLog.setOutputTokens(response.outputTokens());
        usageLog.setLatencyMs(response.latencyMs());
        usageLog.setSuccess(response.success());

        if (!response.success()) {
            usageLog.setErrorMessage(truncate(response.error(), 500));
            usageLogRepository.save(usageLog);
            eventPublisher.publishEvent(new AiTaskCompletedEvent(userId, "CHAT", false, null));
            throw new IllegalStateException("Erreur IA : " + response.error());
        }

        usageLogRepository.save(usageLog);

        AiChatMessage assistantMsg = new AiChatMessage();
        assistantMsg.setUserId(userId);
        assistantMsg.setRole("assistant");
        assistantMsg.setContent(response.text());
        chatRepository.save(assistantMsg);

        eventPublisher.publishEvent(new AiTaskCompletedEvent(userId, "CHAT", true, null));

        return new ChatMessageResponse(
            assistantMsg.getId(), "assistant", response.text(), assistantMsg.getCreatedAt()
        );
    }

    @Transactional(readOnly = true)
    public List<ChatMessageResponse> getChatHistory(UUID userId) {
        return chatRepository.findByUserIdOrderByCreatedAtAsc(userId).stream()
            .map(m -> new ChatMessageResponse(m.getId(), m.getRole(), m.getContent(), m.getCreatedAt()))
            .toList();
    }

    @Transactional
    public void clearChatHistory(UUID userId) {
        chatRepository.deleteByUserId(userId);
    }

    private <T> T callAi(String systemPrompt, String userPrompt, Class<T> responseType,
                          AiTask task, UUID userId, String entityType, UUID entityId) {
        AiUsageLog usageLog = new AiUsageLog();
        usageLog.setTask(task);
        usageLog.setUserId(userId);
        usageLog.setEntityType(entityType);
        usageLog.setEntityId(entityId);
        usageLog.setModel(modelId);

        AnthropicClient.Response response = anthropicClient.call(systemPrompt, userPrompt);

        usageLog.setInputTokens(response.inputTokens());
        usageLog.setOutputTokens(response.outputTokens());
        usageLog.setLatencyMs(response.latencyMs());
        usageLog.setSuccess(response.success());

        if (!response.success()) {
            usageLog.setErrorMessage(truncate(response.error(), 500));
            usageLogRepository.save(usageLog);
            eventPublisher.publishEvent(new AiTaskCompletedEvent(userId, task.name(), false, null));
            throw new IllegalStateException("Erreur IA : " + response.error());
        }

        usageLogRepository.save(usageLog);

        try {
            String json = extractJson(response.text());
            T result = objectMapper.readValue(json, responseType);
            eventPublisher.publishEvent(new AiTaskCompletedEvent(userId, task.name(), true, null));
            return result;
        } catch (Exception e) {
            log.error("Failed to parse AI response for task {}: {}", task, e.getMessage());
            eventPublisher.publishEvent(new AiTaskCompletedEvent(userId, task.name(), false, null));
            throw new IllegalStateException("Erreur de parsing de la reponse IA", e);
        }
    }

    private String buildOfferContext(Offer offer) {
        StringBuilder sb = new StringBuilder();
        sb.append("Offre : ").append(offer.getName()).append("\n");
        sb.append("Statut : ").append(offer.getStatus()).append("\n");
        if (offer.getShortDescription() != null) sb.append("Description courte : ").append(offer.getShortDescription()).append("\n");
        if (offer.getLongDescription() != null) sb.append("Description longue : ").append(offer.getLongDescription()).append("\n");
        if (offer.getPromotionalPrice() != null) sb.append("Prix promotionnel : ").append(offer.getPromotionalPrice()).append(" ").append(offer.getCurrency()).append("\n");
        if (offer.getTargetSegment() != null) sb.append("Segment cible : ").append(offer.getTargetSegment()).append("\n");
        if (offer.getCustomerType() != null) sb.append("Type client : ").append(offer.getCustomerType()).append("\n");
        if (offer.getValidFrom() != null) sb.append("Valide du : ").append(offer.getValidFrom()).append("\n");
        if (offer.getValidUntil() != null) sb.append("Valide jusqu'au : ").append(offer.getValidUntil()).append("\n");
        if (offer.getSeoTitle() != null) sb.append("SEO Titre : ").append(offer.getSeoTitle()).append("\n");
        if (offer.getSeoDescription() != null) sb.append("SEO Description : ").append(offer.getSeoDescription()).append("\n");
        if (offer.getLegalMentions() != null) sb.append("Mentions legales : ").append(offer.getLegalMentions()).append("\n");

        var items = offer.getItems();
        if (items != null && !items.isEmpty()) {
            sb.append("\nProduits/Services inclus :\n");
            var catalogItemIds = items.stream().map(i -> i.getCatalogItemId()).toList();
            var catalogItems = catalogItemRepository.findAllById(catalogItemIds);
            for (var catalogItem : catalogItems) {
                sb.append("  - ").append(catalogItem.getName());
                if (catalogItem.getBasePrice() != null) {
                    sb.append(" (").append(catalogItem.getBasePrice()).append(" ").append(catalogItem.getCurrency()).append(")");
                }
                sb.append("\n");
            }
        }

        return sb.toString();
    }

    private String extractJson(String content) {
        if (content == null) throw new IllegalStateException("Reponse IA vide");
        int start = content.indexOf('{');
        int end = content.lastIndexOf('}');
        if (start >= 0 && end > start) {
            return content.substring(start, end + 1);
        }
        return content;
    }

    private void checkDailyLimit(UUID userId) {
        long todayCount = usageLogRepository.countByUserIdSince(userId, LocalDateTime.now().toLocalDate().atStartOfDay());
        if (todayCount >= dailyLimitPerUser) {
            throw new IllegalStateException(
                "Limite quotidienne IA atteinte (" + dailyLimitPerUser + " requetes/jour). Reessayez demain.");
        }
    }

    private Offer findOffer(UUID offerId) {
        return offerRepository.findById(offerId)
                .orElseThrow(() -> new IllegalArgumentException("Offre introuvable : " + offerId));
    }

    private String truncate(String s, int max) {
        if (s == null) return null;
        return s.length() > max ? s.substring(0, max) + "..." : s;
    }
}
