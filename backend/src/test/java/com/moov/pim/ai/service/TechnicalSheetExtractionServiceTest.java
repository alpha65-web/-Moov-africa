package com.moov.pim.ai.service;

import com.moov.pim.ai.api.dto.SheetExtractionRequest;
import com.moov.pim.ai.api.dto.SheetExtractionResponse;
import com.moov.pim.catalog.domain.Category;
import com.moov.pim.catalog.domain.ItemType;
import com.moov.pim.catalog.repository.CategoryRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;

import java.lang.reflect.Field;
import java.math.BigDecimal;
import java.util.List;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.when;

/**
 * Lecture d'une fiche technique.
 *
 * Le cahier des charges (7.10) confie a l'auto-tagging « l'extraction automatique
 * de donnees depuis des fiches techniques, cote chef de produit, a la creation ».
 * Aucun service ne lisait de document : la generation de mots-cles existante part
 * des champs deja saisis en base, c'est-a-dire du resultat que l'extraction est
 * censee produire.
 *
 * Les fiches de ces tests sont ecrites comme elles le sont reellement chez un
 * operateur : l'une en lignes etiquetees, l'autre en paragraphe.
 */
@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class TechnicalSheetExtractionServiceTest {

    private static final String FICHE_ETIQUETEE = """
            Nom commercial : Forfait Internet Max
            Volume : 25 Go
            Validité : 30 jours
            Débit : 20 Mbps
            Prix : 12 500 FCFA
            Facturation : par mois
            Zone de couverture : Ouagadougou et Bobo-Dioulasso
            """;

    private static final String FICHE_REDIGEE = """
            Pass Jeune Illimité

            Ce pass s'adresse aux étudiants et leur donne 10 Go de navigation
            internet en 4G, 200 minutes d'appel vers tous les réseaux et 100 SMS,
            le tout valable 7 jours pour 2 000 FCFA.
            """;

    @Mock private CategoryRepository categoryRepository;

    private TechnicalSheetExtractionService service;

    @BeforeEach
    void setUp() {
        service = new TechnicalSheetExtractionService(categoryRepository);
        when(categoryRepository.findByTypeOrderByNameAsc(any())).thenReturn(List.of());
    }

    @Test
    void extract_shouldReadALabelledSheet() {
        SheetExtractionResponse result = extract(FICHE_ETIQUETEE, "SERVICE");

        assertEquals("Forfait Internet Max", result.name());
        assertEquals(0, new BigDecimal("12500").compareTo(result.basePrice()));
        assertEquals("XOF", result.currency());
        assertEquals("DATA", result.serviceType());
        assertEquals("MONTHLY", result.billingCycle());
    }

    /**
     * Une fiche redigee en paragraphe ne comporte aucune ligne etiquetee. Tout y
     * est pourtant dit : les grandeurs chiffrees doivent etre relevees dans le
     * texte courant, sans quoi la fonction ne servirait que sur des fiches deja
     * structurees — c'est-a-dire la ou elle apporte le moins.
     */
    @Test
    void extract_shouldReadASheetWrittenInProse() {
        SheetExtractionResponse result = extract(FICHE_REDIGEE, "SERVICE");

        assertEquals("Pass Jeune Illimité", result.name());
        assertEquals(0, new BigDecimal("2000").compareTo(result.basePrice()));
        assertEquals("DATA", result.serviceType());
        assertNotNull(result.characteristics());
        assertTrue(result.characteristics().contains("10 Go"));
        assertTrue(result.characteristics().contains("200 minutes")
                || result.characteristics().contains("200 min"));
        assertTrue(result.characteristics().contains("100 SMS"));
    }

    @Test
    void extract_shouldListTheCharacteristicsOfALabelledSheet() {
        SheetExtractionResponse result = extract(FICHE_ETIQUETEE, "SERVICE");

        assertTrue(result.characteristics().contains("Volume : 25 Go"));
        assertTrue(result.characteristics().contains("Débit : 20 Mbps"));
        assertTrue(result.characteristics().contains("Zone de couverture : Ouagadougou et Bobo-Dioulasso"));
        // Le nom et le prix sont des champs a part entiere : les repeter en
        // caracteristique ferait doublon dans la fiche produite.
        assertFalse(result.characteristics().contains("Nom commercial"));
        assertFalse(result.characteristics().contains("Prix :"));
    }

    @Test
    void extract_shouldProposeKeywordsDrawnFromWhatItRecognised() {
        SheetExtractionResponse result = extract(FICHE_REDIGEE, "SERVICE");

        assertTrue(result.tags().contains("data"));
        assertTrue(result.tags().contains("illimité"));
        assertTrue(result.tags().contains("jeune"));
    }

    /**
     * Un champ non reconnu doit rester nul. Le remplir d'une valeur plausible
     * transformerait une lecture ratee en donnee de reference.
     */
    @Test
    void extract_shouldLeaveUnreadableFieldsEmptyAndSaySo() {
        SheetExtractionResponse result = extract("Routeur 4G de bureau, coloris blanc.", "PRODUCT");

        assertNull(result.basePrice());
        assertNull(result.billingCycle());
        assertTrue(result.notes().stream().anyMatch(n -> n.contains("Aucun prix")));
        assertTrue(result.notes().stream().anyMatch(n -> n.contains("périodicité")));
    }

    /** Le mobile money ne se confond avec aucune autre nature de service. */
    @Test
    void extract_shouldRecogniseMobileMoney() {
        SheetExtractionResponse result = extract(
                "Service de transfert d'argent et de paiement marchand, 500 FCFA par mois.", "SERVICE");

        assertEquals("MOBILE_MONEY", result.serviceType());
    }

    // ===================================================================
    // Rapprochement avec le referentiel de categories
    // ===================================================================

    /**
     * La categorie proposee vient du referentiel reellement enregistre, jamais
     * d'un libelle invente : une categorie inexistante ne serait pas selectionnable
     * dans le formulaire et la proposition serait inutilisable.
     */
    @Test
    void extract_shouldProposeACategoryFromTheRealReferential() {
        Category data = category("Forfaits Data", "Internet mobile et navigation", null, 1);
        Category voice = category("Forfaits Voix", "Appels et SMS", null, 1);
        when(categoryRepository.findByTypeOrderByNameAsc(ItemType.SERVICE))
                .thenReturn(List.of(data, voice));

        SheetExtractionResponse result = extract(FICHE_ETIQUETEE, "SERVICE");

        assertEquals(data.getId(), result.categoryId());
        assertEquals("Forfaits Data", result.categoryPath());
    }

    /** A pertinence egale, la sous-categorie range plus finement. */
    @Test
    void extract_shouldPreferTheDeepestMatchingCategory() {
        Category parent = category("Forfaits Data", "Internet mobile", null, 1);
        Category child = category("Forfaits Data", "Internet mobile", parent, 2);
        when(categoryRepository.findByTypeOrderByNameAsc(ItemType.SERVICE))
                .thenReturn(List.of(parent, child));

        SheetExtractionResponse result = extract(FICHE_ETIQUETEE, "SERVICE");

        assertEquals(child.getId(), result.categoryId());
        assertEquals("Forfaits Data › Forfaits Data", result.categoryPath());
    }

    @Test
    void extract_shouldSayWhenNoCategoryMatches() {
        when(categoryRepository.findByTypeOrderByNameAsc(ItemType.SERVICE))
                .thenReturn(List.of(category("Mobile Money", "Transfert et paiement", null, 1)));

        SheetExtractionResponse result = extract("Routeur de bureau, coloris blanc.", "SERVICE");

        assertNull(result.categoryId());
        assertTrue(result.notes().stream().anyMatch(n -> n.contains("Aucune catégorie")));
    }

    /** Une categorie desactivee n'est plus selectionnable : la proposer serait un piege. */
    @Test
    void extract_shouldIgnoreDeactivatedCategories() {
        Category retired = category("Forfaits Data", "Internet mobile", null, 1);
        retired.setActive(false);
        when(categoryRepository.findByTypeOrderByNameAsc(ItemType.SERVICE)).thenReturn(List.of(retired));

        assertNull(extract(FICHE_ETIQUETEE, "SERVICE").categoryId());
    }

    // ===================================================================

    private SheetExtractionResponse extract(String content, String itemType) {
        return service.extract(new SheetExtractionRequest(content, itemType));
    }

    private static Category category(String name, String description, Category parent, int level) {
        Category category = new Category(name, description, parent, level, ItemType.SERVICE);
        setField(category, "id", UUID.randomUUID());
        return category;
    }

    private static void setField(Object target, String fieldName, Object value) {
        try {
            Field field = target.getClass().getDeclaredField(fieldName);
            field.setAccessible(true);
            field.set(target, value);
        } catch (Exception e) {
            throw new RuntimeException(e);
        }
    }
}
