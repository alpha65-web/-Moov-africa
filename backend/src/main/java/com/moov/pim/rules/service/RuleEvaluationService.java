package com.moov.pim.rules.service;

import com.moov.pim.catalog.domain.CatalogItem;
import com.moov.pim.catalog.domain.Pack;
import com.moov.pim.catalog.domain.Product;
import com.moov.pim.catalog.domain.Service;
import com.moov.pim.catalog.repository.CatalogItemRepository;
import com.moov.pim.rules.api.dto.RuleViolation;
import com.moov.pim.rules.domain.BusinessRule;
import com.moov.pim.rules.domain.RuleType;
import com.moov.pim.rules.repository.BusinessRuleRepository;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.Collection;
import java.util.HashSet;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.function.Function;
import java.util.stream.Collectors;

/**
 * Controle de la composition d'une offre au regard des regles metier.
 *
 * C'est le module 7.3 du cahier des charges — « le systeme doit bloquer ou
 * avertir *avant* la soumission ». Il etait entierement absent du circuit :
 * BusinessRuleService savait creer, modifier, activer et supprimer des regles,
 * mais aucun code n'en evaluait jamais une seule. Verifie par recherche sur tout
 * le depot : le paquetage rules n'etait reference nulle part dans lifecycle.
 * Un chef de produit pouvait donc assembler une offre convergente sans composante
 * Mobile Money, ou reunir deux produits declares incompatibles, sans que rien ne
 * le signale — les regles saisies a l'ecran n'avaient aucun effet.
 *
 * L'evaluation porte sur l'ensemble des briques composant l'offre, y compris
 * celles apportees indirectement par un pack : une contrainte declaree sur un
 * service doit s'appliquer que ce service soit ajoute seul ou via un pack qui le
 * contient.
 */
@org.springframework.stereotype.Service
public class RuleEvaluationService {

    private final BusinessRuleRepository ruleRepository;
    private final CatalogItemRepository catalogItemRepository;

    public RuleEvaluationService(BusinessRuleRepository ruleRepository,
                                 CatalogItemRepository catalogItemRepository) {
        this.ruleRepository = ruleRepository;
        this.catalogItemRepository = catalogItemRepository;
    }

    /**
     * Evalue une composition et renvoie toutes les violations constatees,
     * bloquantes comme non bloquantes.
     *
     * Une composition vide ne viole rien : une offre en cours de saisie n'a pas a
     * etre refusee parce qu'elle n'a pas encore de briques. C'est la soumission
     * qui exigera qu'elle en ait.
     */
    @Transactional(readOnly = true)
    public List<RuleViolation> evaluate(Collection<UUID> composition) {
        if (composition == null || composition.isEmpty()) return List.of();

        Set<UUID> directIds = new LinkedHashSet<>(composition);
        Map<UUID, CatalogItem> itemsById = catalogItemRepository.findAllById(directIds).stream()
                .collect(Collectors.toMap(CatalogItem::getId, Function.identity(), (a, b) -> a));

        // Perimetre effectif : les briques choisies, plus le contenu des packs.
        Set<UUID> effectiveIds = new LinkedHashSet<>(directIds);
        for (CatalogItem item : itemsById.values()) {
            if (item instanceof Pack pack) {
                pack.getItems().forEach(packItem -> effectiveIds.add(packItem.getCatalogItemId()));
            }
        }

        List<RuleViolation> violations = new ArrayList<>();
        violations.addAll(evaluateDeclaredRules(effectiveIds));
        violations.addAll(evaluatePackOnly(directIds, itemsById));
        return violations;
    }

    /** Ne retient que les violations qui doivent empecher l'enregistrement. */
    public List<RuleViolation> blockingOnly(List<RuleViolation> violations) {
        return violations.stream().filter(RuleViolation::blocking).toList();
    }

    private List<RuleViolation> evaluateDeclaredRules(Set<UUID> effectiveIds) {
        // Une seule lecture : les regles portant sur l'une des briques presentes.
        Set<BusinessRule> applicable = new LinkedHashSet<>();
        for (UUID id : effectiveIds) {
            applicable.addAll(ruleRepository.findBySourceItemIdOrTargetItemId(id, id));
        }

        Set<UUID> named = new HashSet<>(effectiveIds);
        List<RuleViolation> violations = new ArrayList<>();

        for (BusinessRule rule : applicable) {
            if (!rule.isActive()) continue;

            boolean hasSource = named.contains(rule.getSourceItemId());
            boolean hasTarget = named.contains(rule.getTargetItemId());

            switch (rule.getRuleType()) {
                // Les deux briques ne peuvent pas coexister dans une meme offre.
                case INCOMPATIBILITY -> {
                    if (hasSource && hasTarget) {
                        violations.add(violation(rule,
                                "Ces deux éléments sont déclarés incompatibles et ne peuvent pas "
                                        + "figurer ensemble dans une même offre."));
                    }
                }
                // La presence de la premiere brique impose celle de la seconde :
                // c'est la regle qui garantit qu'une offre convergente comporte
                // bien sa composante Mobile Money.
                case MANDATORY_COMPOSITION -> {
                    if (hasSource && !hasTarget) {
                        violations.add(violation(rule,
                                "La composition obligatoire n'est pas respectée : un élément requis "
                                        + "par cette règle est absent de l'offre."));
                    }
                }
                // COMPATIBILITY est une declaration positive : elle indique que deux
                // briques vont ensemble. Elle ne peut donc pas etre violee, et ne
                // produit volontairement aucune alerte — signaler une compatibilite
                // respectee reviendrait a noyer les vraies violations.
                case COMPATIBILITY -> { }
                // PACK_ONLY est portee par l'element lui-meme, pas par le couple de
                // briques : elle est evaluee separement.
                case PACK_ONLY -> { }
            }
        }
        return violations;
    }

    /**
     * Un produit ou un service marque « vendable uniquement en pack » ne peut pas
     * figurer directement dans la composition d'une offre : il doit y entrer par
     * l'intermediaire d'un pack qui le contient.
     *
     * La contrainte est lue sur l'element lui-meme et non dans la table des regles,
     * parce que c'est la qu'elle est reellement saisie — les ecrans du catalogue
     * exposent une case « vendable uniquement en pack » sur le produit et sur le
     * service.
     */
    private List<RuleViolation> evaluatePackOnly(Set<UUID> directIds, Map<UUID, CatalogItem> itemsById) {
        List<RuleViolation> violations = new ArrayList<>();

        for (UUID id : directIds) {
            CatalogItem item = itemsById.get(id);
            if (item == null) continue;

            boolean packOnly = (item instanceof Product product && product.isPackOnly())
                    || (item instanceof Service service && service.isPackOnly());

            if (packOnly) {
                violations.add(new RuleViolation(null, item.getName(), RuleType.PACK_ONLY.name(),
                        "« " + item.getName() + " » n'est vendable qu'au sein d'un pack : "
                                + "ajoutez le pack qui le contient plutôt que l'élément seul.",
                        true));
            }
        }
        return violations;
    }

    private static RuleViolation violation(BusinessRule rule, String message) {
        return new RuleViolation(rule.getId(), rule.getName(), rule.getRuleType().name(),
                rule.getName() + " — " + message, rule.isBlocking());
    }
}
