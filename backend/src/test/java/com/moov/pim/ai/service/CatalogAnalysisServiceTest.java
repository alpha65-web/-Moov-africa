package com.moov.pim.ai.service;

import com.moov.pim.ai.api.dto.AiInsightsResponse;
import com.moov.pim.ai.api.dto.AiRecommendation;
import com.moov.pim.campaign.repository.CampaignRepository;
import com.moov.pim.catalog.domain.Product;
import com.moov.pim.catalog.repository.CatalogItemRepository;
import com.moov.pim.catalog.repository.CategoryRepository;
import com.moov.pim.dam.repository.MediaAssetRepository;
import com.moov.pim.dam.repository.OfferMediaRepository;
import com.moov.pim.lifecycle.domain.Offer;
import com.moov.pim.lifecycle.domain.OfferStatus;
import com.moov.pim.lifecycle.repository.OfferRepository;
import com.moov.pim.rules.repository.BusinessRuleRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;

import java.lang.reflect.Field;
import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class CatalogAnalysisServiceTest {

    @Mock private CatalogItemRepository catalogItemRepository;
    @Mock private CategoryRepository categoryRepository;
    @Mock private OfferRepository offerRepository;
    @Mock private OfferMediaRepository offerMediaRepository;
    @Mock private MediaAssetRepository mediaAssetRepository;
    @Mock private CampaignRepository campaignRepository;
    @Mock private BusinessRuleRepository businessRuleRepository;

    @InjectMocks private CatalogAnalysisService service;

    @BeforeEach
    void setUp() {
        when(catalogItemRepository.findAll()).thenReturn(List.of());
        when(categoryRepository.findAll()).thenReturn(List.of());
        when(offerRepository.findAll()).thenReturn(List.of());
        when(mediaAssetRepository.findAll()).thenReturn(List.of());
        when(campaignRepository.findAll()).thenReturn(List.of());
        when(businessRuleRepository.findAll()).thenReturn(List.of());
        when(offerMediaRepository.findByOfferIdOrderByDisplayOrderAsc(org.mockito.ArgumentMatchers.any()))
                .thenReturn(List.of());
    }

    @Test
    void analyse_onEmptyRepository_shouldReturnPerfectScore() {
        AiInsightsResponse result = service.analyse();

        assertEquals(100, result.qualityScore());
        assertEquals(0, result.anomalies());
        assertTrue(result.recommendations().isEmpty());
        assertTrue(result.penalties().isEmpty());
    }

    @Test
    void analyse_shouldFlagCatalogItemWithoutDescription() {
        Product product = new Product();
        product.setName("Carte SIM");
        product.setDescription("court");
        product.setCategoryId(UUID.randomUUID());
        setId(product, UUID.randomUUID());
        when(catalogItemRepository.findAll()).thenReturn(List.of(product));

        AiInsightsResponse result = service.analyse();

        assertEquals(1, result.itemsWithoutDescription());
        assertTrue(result.recommendations().stream()
                .anyMatch(r -> "CATALOG_MISSING_DESCRIPTION".equals(r.code())
                        && AiRecommendation.HIGH.equals(r.priority())));
        // 100 % des elements actifs sont concernes : la penalite maximale de 25 s'applique.
        assertEquals(75, result.qualityScore());
    }

    @Test
    void analyse_shouldFlagPublishedOfferPastItsEndDate() {
        Offer offer = new Offer();
        offer.setName("Promo Data");
        offer.setStatus(OfferStatus.PUBLISHED);
        offer.setValidUntil(LocalDateTime.now().minusDays(3));
        offer.setSeoTitle("Promo Data");
        offer.setSeoDescription("Promo Data 5 Go");
        setId(offer, UUID.randomUUID());
        when(offerRepository.findAll()).thenReturn(List.of(offer));

        AiInsightsResponse result = service.analyse();

        assertTrue(result.recommendations().stream()
                .anyMatch(r -> "OFFER_EXPIRED_STILL_PUBLISHED".equals(r.code())));
        assertTrue(result.anomalies() >= 1);
    }

    @Test
    void analyse_shouldReportSnapshotCounts() {
        Product product = new Product();
        product.setName("Routeur 4G");
        product.setDescription("Routeur 4G LTE domestique pour toute la maison.");
        product.setCategoryId(UUID.randomUUID());
        setId(product, UUID.randomUUID());
        when(catalogItemRepository.findAll()).thenReturn(List.of(product));

        AiInsightsResponse result = service.analyse();

        assertEquals(1, result.snapshot().catalogItems());
        assertEquals(1, result.snapshot().activeCatalogItems());
        assertEquals(100, result.qualityScore());
    }

    private void setId(Object entity, UUID id) {
        try {
            Field field = entity.getClass().getSuperclass().getDeclaredField("id");
            field.setAccessible(true);
            field.set(entity, id);
        } catch (NoSuchFieldException e) {
            try {
                Field field = entity.getClass().getDeclaredField("id");
                field.setAccessible(true);
                field.set(entity, id);
            } catch (ReflectiveOperationException ex) {
                throw new IllegalStateException(ex);
            }
        } catch (IllegalAccessException e) {
            throw new IllegalStateException(e);
        }
    }
}
