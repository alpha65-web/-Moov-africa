package com.moov.pim.rules.service;

import com.moov.pim.catalog.domain.CatalogItem;
import com.moov.pim.catalog.domain.Pack;
import com.moov.pim.catalog.domain.PackItem;
import com.moov.pim.catalog.domain.Product;
import com.moov.pim.catalog.repository.CatalogItemRepository;
import com.moov.pim.rules.api.dto.RuleViolation;
import com.moov.pim.rules.domain.BusinessRule;
import com.moov.pim.rules.domain.RuleType;
import com.moov.pim.rules.repository.BusinessRuleRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;

import java.lang.reflect.Field;
import java.util.List;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.when;

/**
 * Controle de la composition d'une offre au regard des regles metier.
 *
 * Le module des regles n'etait interroge nulle part : BusinessRuleService savait
 * creer, modifier et supprimer des regles, mais aucun code n'en evaluait jamais
 * une seule. Les contraintes saisies a l'ecran n'avaient donc aucun effet.
 */
@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class RuleEvaluationServiceTest {

    @Mock private BusinessRuleRepository ruleRepository;
    @Mock private CatalogItemRepository catalogItemRepository;
    @InjectMocks private RuleEvaluationService service;

    /**
     * Deux briques declarees incompatibles ne peuvent pas figurer ensemble dans
     * une meme offre.
     */
    @Test
    void incompatibilite_estBloquanteQuandLesDeuxBriquesSontPresentes() {
        UUID sim = UUID.randomUUID();
        UUID forfait = UUID.randomUUID();

        when(catalogItemRepository.findAllById(any())).thenReturn(List.of(
                product(sim, "SIM prépayée", false), product(forfait, "Forfait postpayé", false)));
        when(ruleRepository.findBySourceItemIdOrTargetItemId(any(), any())).thenReturn(
                List.of(rule("Prépayé et postpayé", RuleType.INCOMPATIBILITY, sim, forfait, true)));

        List<RuleViolation> violations = service.evaluate(List.of(sim, forfait));

        assertEquals(1, violations.size());
        assertTrue(violations.get(0).blocking());
        assertEquals("INCOMPATIBILITY", violations.get(0).ruleType());
    }

    /** La meme regle ne dit rien tant qu'une seule des deux briques est presente. */
    @Test
    void incompatibilite_neDitRienSiUneSeuleBriqueEstPresente() {
        UUID sim = UUID.randomUUID();
        UUID forfait = UUID.randomUUID();

        when(catalogItemRepository.findAllById(any())).thenReturn(List.of(product(sim, "SIM", false)));
        when(ruleRepository.findBySourceItemIdOrTargetItemId(any(), any())).thenReturn(
                List.of(rule("Prépayé et postpayé", RuleType.INCOMPATIBILITY, sim, forfait, true)));

        assertTrue(service.evaluate(List.of(sim)).isEmpty());
    }

    /**
     * C'est la regle qui garantit qu'une offre convergente comporte bien sa
     * composante Mobile Money : la presence de la premiere brique impose celle de
     * la seconde.
     */
    @Test
    void compositionObligatoire_estVioleeQuandLaBriqueRequiseManque() {
        UUID data = UUID.randomUUID();
        UUID mobileMoney = UUID.randomUUID();

        when(catalogItemRepository.findAllById(any())).thenReturn(List.of(product(data, "Forfait data", false)));
        when(ruleRepository.findBySourceItemIdOrTargetItemId(any(), any())).thenReturn(
                List.of(rule("Convergente : data + Mobile Money",
                        RuleType.MANDATORY_COMPOSITION, data, mobileMoney, true)));

        List<RuleViolation> violations = service.evaluate(List.of(data));

        assertEquals(1, violations.size());
        assertEquals("MANDATORY_COMPOSITION", violations.get(0).ruleType());
    }

    /**
     * Une contrainte declaree sur un service doit s'appliquer que ce service soit
     * ajoute seul ou apporte par un pack qui le contient. Sans cela, il suffirait
     * d'emballer une brique dans un pack pour contourner la regle.
     */
    @Test
    void compositionObligatoire_estSatisfaiteParUneBriqueApporteeParUnPack() {
        UUID data = UUID.randomUUID();
        UUID mobileMoney = UUID.randomUUID();
        UUID pack = UUID.randomUUID();

        when(catalogItemRepository.findAllById(any())).thenReturn(List.of(
                product(data, "Forfait data", false), packContaining(pack, "Pack Mobile Money", mobileMoney)));
        when(ruleRepository.findBySourceItemIdOrTargetItemId(any(), any())).thenReturn(
                List.of(rule("Convergente : data + Mobile Money",
                        RuleType.MANDATORY_COMPOSITION, data, mobileMoney, true)));

        assertTrue(service.evaluate(List.of(data, pack)).isEmpty());
    }

    /**
     * Une regle non bloquante signale sans refuser : c'est ce qui permet
     * d'introduire une contrainte sur un catalogue deja constitue.
     */
    @Test
    void regleNonBloquante_estSignaleeMaisNeBloquePas() {
        UUID a = UUID.randomUUID();
        UUID b = UUID.randomUUID();

        when(catalogItemRepository.findAllById(any())).thenReturn(List.of(
                product(a, "A", false), product(b, "B", false)));
        when(ruleRepository.findBySourceItemIdOrTargetItemId(any(), any())).thenReturn(
                List.of(rule("Avertissement", RuleType.INCOMPATIBILITY, a, b, false)));

        List<RuleViolation> violations = service.evaluate(List.of(a, b));

        assertEquals(1, violations.size());
        assertFalse(violations.get(0).blocking());
        assertTrue(service.blockingOnly(violations).isEmpty());
    }

    /**
     * « Vendable uniquement en pack » est porte par l'element lui-meme, pas par la
     * table des regles : c'est la qu'il est saisi dans les ecrans du catalogue.
     */
    @Test
    void vendableUniquementEnPack_refuseLaBriqueAjouteeSeule() {
        UUID terminal = UUID.randomUUID();

        when(catalogItemRepository.findAllById(any()))
                .thenReturn(List.of(product(terminal, "Terminal subventionné", true)));
        when(ruleRepository.findBySourceItemIdOrTargetItemId(any(), any())).thenReturn(List.of());

        List<RuleViolation> violations = service.evaluate(List.of(terminal));

        assertEquals(1, violations.size());
        assertTrue(violations.get(0).blocking());
        assertEquals("PACK_ONLY", violations.get(0).ruleType());
        // La contrainte ne vient d'aucune regle de la table : l'identifiant est nul.
        assertNull(violations.get(0).ruleId());
    }

    /**
     * Une offre en cours de saisie n'a pas a etre refusee parce qu'elle n'a pas
     * encore de briques : c'est la soumission qui exigera qu'elle en ait.
     */
    @Test
    void compositionVide_neViolerien() {
        assertTrue(service.evaluate(List.of()).isEmpty());
        assertTrue(service.evaluate(null).isEmpty());
    }

    /**
     * COMPATIBILITY est une declaration positive : elle ne peut pas etre violee.
     * Signaler une compatibilite respectee noierait les vraies violations.
     */
    @Test
    void compatibilite_neProduitAucuneAlerte() {
        UUID a = UUID.randomUUID();
        UUID b = UUID.randomUUID();

        when(catalogItemRepository.findAllById(any())).thenReturn(List.of(
                product(a, "A", false), product(b, "B", false)));
        when(ruleRepository.findBySourceItemIdOrTargetItemId(any(), any())).thenReturn(
                List.of(rule("SIM compatible forfait", RuleType.COMPATIBILITY, a, b, true)));

        assertTrue(service.evaluate(List.of(a, b)).isEmpty());
    }

    /** Une regle desactivee ne s'applique plus. */
    @Test
    void regleDesactivee_estIgnoree() {
        UUID a = UUID.randomUUID();
        UUID b = UUID.randomUUID();
        BusinessRule inactive = rule("Ancienne règle", RuleType.INCOMPATIBILITY, a, b, true);
        setField(BusinessRule.class, inactive, "active", false);

        when(catalogItemRepository.findAllById(any())).thenReturn(List.of(
                product(a, "A", false), product(b, "B", false)));
        when(ruleRepository.findBySourceItemIdOrTargetItemId(any(), any())).thenReturn(List.of(inactive));

        assertTrue(service.evaluate(List.of(a, b)).isEmpty());
    }

    // ------------------------------------------------------------------
    // Fabriques
    // ------------------------------------------------------------------

    private static Product product(UUID id, String name, boolean packOnly) {
        Product product = new Product();
        product.setName(name);
        product.setPackOnly(packOnly);
        setField(CatalogItem.class, product, "id", id);
        return product;
    }

    private static Pack packContaining(UUID id, String name, UUID containedItemId) {
        Pack pack = new Pack();
        pack.setName(name);
        setField(CatalogItem.class, pack, "id", id);
        pack.getItems().add(new PackItem(containedItemId, 1));
        return pack;
    }

    private static BusinessRule rule(String name, RuleType type, UUID source, UUID target, boolean blocking) {
        BusinessRule rule = new BusinessRule();
        rule.setName(name);
        rule.setRuleType(type);
        rule.setSourceItemId(source);
        rule.setTargetItemId(target);
        rule.setBlocking(blocking);
        setField(BusinessRule.class, rule, "id", UUID.randomUUID());
        return rule;
    }

    private static void setField(Class<?> type, Object target, String fieldName, Object value) {
        try {
            Field field = type.getDeclaredField(fieldName);
            field.setAccessible(true);
            field.set(target, value);
        } catch (Exception e) {
            throw new RuntimeException(e);
        }
    }
}
