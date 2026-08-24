package com.moov.pim.ai.service;

import com.moov.pim.ai.api.dto.AiAssistantResponse;
import com.moov.pim.ai.api.dto.AiInsightsResponse;
import com.moov.pim.campaign.repository.CampaignRepository;
import com.moov.pim.catalog.domain.Product;
import com.moov.pim.catalog.repository.CatalogItemRepository;
import com.moov.pim.catalog.repository.CategoryRepository;
import com.moov.pim.dam.repository.MediaAssetRepository;
import com.moov.pim.lifecycle.domain.Offer;
import com.moov.pim.lifecycle.domain.OfferStatus;
import com.moov.pim.lifecycle.repository.OfferRepository;
import com.moov.pim.permissions.repository.UserRepository;
import com.moov.pim.rules.repository.BusinessRuleRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;

import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class AiAssistantServiceTest {

    @Mock private CatalogAnalysisService catalogAnalysisService;
    @Mock private CatalogItemRepository catalogItemRepository;
    @Mock private CategoryRepository categoryRepository;
    @Mock private OfferRepository offerRepository;
    @Mock private CampaignRepository campaignRepository;
    @Mock private MediaAssetRepository mediaAssetRepository;
    @Mock private BusinessRuleRepository businessRuleRepository;
    @Mock private UserRepository userRepository;

    @InjectMocks private AiAssistantService service;

    @Test
    void answer_aboutOffers_shouldCountByStatus() {
        Offer published = new Offer();
        published.setStatus(OfferStatus.PUBLISHED);
        Offer draft = new Offer();
        draft.setStatus(OfferStatus.DRAFT);
        when(offerRepository.findAll()).thenReturn(List.of(published, draft));

        AiAssistantResponse result = service.answer("Combien d'offres sont publiees ?");

        assertEquals("offers", result.topic());
        assertTrue(result.answer().contains("2 offre(s)"));
        assertTrue(result.facts().stream()
                .anyMatch(f -> "Publiees".equals(f.label()) && "1".equals(f.value())));
    }

    @Test
    void answer_aboutCatalog_shouldCountItemsWithoutDescription() {
        Product complete = new Product();
        complete.setName("Routeur");
        complete.setDescription("Routeur 4G LTE domestique pour toute la maison.");
        Product incomplete = new Product();
        incomplete.setName("Cle USB");
        when(catalogItemRepository.findAll()).thenReturn(List.of(complete, incomplete));

        AiAssistantResponse result = service.answer("Quels produits n'ont pas de description ?");

        assertEquals("catalog", result.topic());
        assertTrue(result.facts().stream()
                .anyMatch(f -> "Sans description".equals(f.label()) && "1".equals(f.value())));
    }

    @Test
    void answer_aboutQuality_shouldReuseTheAnalysisScore() {
        when(catalogAnalysisService.analyse()).thenReturn(new AiInsightsResponse(
                72, 3, 5, 2, List.of(), List.of(new AiInsightsResponse.ScorePenalty("Descriptions manquantes", 15)),
                new AiInsightsResponse.Snapshot(0, 0, 0, 0, 0, 0, 0, 0)));

        AiAssistantResponse result = service.answer("Quel est le score qualite du catalogue ?");

        assertEquals("quality", result.topic());
        assertTrue(result.answer().contains("72/100"));
    }

    @Test
    void answer_withoutRecognizedKeyword_shouldReturnOverview() {
        stubInsights();

        AiAssistantResponse result = service.answer("azerty qwerty");

        assertEquals("overview", result.topic());
        assertTrue(result.answer().contains("14 element(s) de catalogue"));
    }

    /**
     * « Bonjour » retournait la vue d'ensemble : un mur de chiffres en guise de
     * salutation, qui donnait a penser que l'assistant n'avait pas compris. L'ecran
     * presente une conversation, elle doit commencer comme une conversation.
     */
    @Test
    void answer_toAGreeting_shouldGreetBack() {
        stubInsights();

        for (String salutation : List.of("Bonjour", "BONJOUR", "salut", "Bonsoir !", "hello")) {
            AiAssistantResponse result = service.answer(salutation);
            assertEquals("greeting", result.topic(), salutation);
            assertTrue(result.answer().startsWith("Bonjour"), salutation + " -> " + result.answer());
            assertTrue(result.answer().contains("offres"), salutation);
        }
    }

    @Test
    void answer_toAHelpRequest_shouldListTheTopics() {
        AiAssistantResponse result = service.answer("Que peux-tu faire ?");

        assertEquals("help", result.topic());
        assertTrue(result.answer().contains("campagnes"));
        assertTrue(result.answer().contains("score qualite"));
    }

    /** Une demande d'aide l'emporte sur la salutation qui la precede. */
    @Test
    void answer_toAGreetingWithHelpRequest_shouldPreferHelp() {
        AiAssistantResponse result = service.answer("Bonjour, que peux-tu faire ?");

        assertEquals("help", result.topic());
    }

    /** Un sujet de donnees l'emporte sur la politesse qui l'accompagne. */
    @Test
    void answer_thankingAboutATopic_shouldStillAnswerTheTopic() {
        when(offerRepository.findAll()).thenReturn(List.of());

        AiAssistantResponse result = service.answer("Merci, et combien d'offres publiees ?");

        assertEquals("offers", result.topic());
    }

    @Test
    void answer_toThanks_shouldAcknowledgeBriefly() {
        AiAssistantResponse result = service.answer("merci");

        assertEquals("thanks", result.topic());
        assertTrue(result.facts().isEmpty());
    }

    private void stubInsights() {
        when(catalogAnalysisService.analyse()).thenReturn(new AiInsightsResponse(
                100, 0, 0, 0, List.of(), List.of(),
                new AiInsightsResponse.Snapshot(14, 13, 8, 4, 2, 1, 0, 3)));
    }

    @Test
    void answer_shouldIgnoreAccentsAndCase() {
        when(campaignRepository.findAll()).thenReturn(List.of());

        AiAssistantResponse result = service.answer("Etat des CAMPAGNES actives");

        assertEquals("campaigns", result.topic());
    }
}
