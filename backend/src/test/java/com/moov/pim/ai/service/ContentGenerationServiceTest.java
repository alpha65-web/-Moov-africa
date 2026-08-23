package com.moov.pim.ai.service;

import com.moov.pim.ai.api.dto.AiGenerationRequest;
import com.moov.pim.ai.api.dto.AiGenerationResponse;
import com.moov.pim.catalog.domain.Product;
import com.moov.pim.catalog.repository.CatalogItemRepository;
import com.moov.pim.catalog.repository.CategoryRepository;
import com.moov.pim.lifecycle.repository.OfferRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.lang.reflect.Field;
import java.math.BigDecimal;
import java.util.Optional;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class ContentGenerationServiceTest {

    @Mock private CatalogItemRepository catalogItemRepository;
    @Mock private CategoryRepository categoryRepository;
    @Mock private OfferRepository offerRepository;

    @InjectMocks private ContentGenerationService service;

    @Test
    void generate_fromFreeSubject_shouldMentionTheSubject() {
        AiGenerationResponse result = service.generate(new AiGenerationRequest(
                "DESCRIPTION", "PROFESSIONAL", "fr", null, null, "Forfait Data 5 Go"));

        assertTrue(result.content().startsWith("Forfait Data 5 Go"));
        assertEquals("DESCRIPTION", result.type());
        assertTrue(result.source().contains("Forfait Data 5 Go"));
    }

    @Test
    void generate_withoutAnySubject_shouldFail() {
        AiGenerationRequest request = new AiGenerationRequest(
                "DESCRIPTION", "PROFESSIONAL", "fr", null, null, "  ");

        assertThrows(IllegalArgumentException.class, () -> service.generate(request));
    }

    @Test
    void generate_fromCatalogItem_shouldUseRealNameAndPrice() {
        UUID itemId = UUID.randomUUID();
        Product product = new Product();
        product.setName("Routeur 4G LTE");
        product.setDescription("Routeur domestique jusqu a 32 connexions simultanees.");
        product.setBasePrice(new BigDecimal("35000.00"));
        setId(product, itemId);
        when(catalogItemRepository.findById(itemId)).thenReturn(Optional.of(product));

        AiGenerationResponse result = service.generate(new AiGenerationRequest(
                "DESCRIPTION", "PROFESSIONAL", "fr", itemId, null, null));

        assertTrue(result.content().contains("Routeur 4G LTE"));
        assertTrue(result.content().contains("35000 XOF"));
        assertEquals("Catalogue : Routeur 4G LTE", result.source());
    }

    @Test
    void generate_tags_shouldDeriveKeywordsFromTheName() {
        AiGenerationResponse result = service.generate(new AiGenerationRequest(
                "TAGS", "PROFESSIONAL", "fr", null, null, "Forfait Data 5 Go"));

        assertEquals("TAGS", result.type());
        assertTrue(result.content().contains("moov-africa"));
        assertTrue(result.content().contains("forfait"));
        assertTrue(result.content().contains("data"));
    }

    @Test
    void generate_translation_shouldSwitchLanguage() {
        AiGenerationResponse result = service.generate(new AiGenerationRequest(
                "TRANSLATION", "PROFESSIONAL", "en", null, null, "Forfait Data 5 Go"));

        assertEquals("TRANSLATION", result.type());
        assertEquals("en", result.language());
        assertTrue(result.content().contains("Moov Africa network"));
    }

    @Test
    void generate_withUnknownType_shouldFallBackToDescription() {
        AiGenerationResponse result = service.generate(new AiGenerationRequest(
                "N_IMPORTE_QUOI", null, null, null, null, "Pack Decouverte"));

        assertEquals("DESCRIPTION", result.type());
        assertEquals("PROFESSIONAL", result.tone());
        assertFalse(result.content().isBlank());
    }

    private void setId(Object entity, UUID id) {
        try {
            Field field = entity.getClass().getSuperclass().getDeclaredField("id");
            field.setAccessible(true);
            field.set(entity, id);
        } catch (ReflectiveOperationException e) {
            throw new IllegalStateException(e);
        }
    }
}
