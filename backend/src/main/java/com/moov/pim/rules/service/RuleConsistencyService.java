package com.moov.pim.rules.service;

import com.moov.pim.catalog.domain.CatalogItem;
import com.moov.pim.catalog.domain.CatalogItemStatus;
import com.moov.pim.catalog.repository.CatalogItemRepository;
import com.moov.pim.rules.api.dto.RuleConsistencyIssue;
import com.moov.pim.rules.domain.BusinessRule;
import com.moov.pim.rules.domain.RuleType;
import com.moov.pim.rules.repository.BusinessRuleRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.function.Function;
import java.util.stream.Collectors;

/**
 * Verification de la coherence globale des regles metier.
 *
 * Chaque regle est valide prise isolement ; les incoherences naissent de leur
 * ensemble. Cinq familles sont recherchees, toutes calculees sur l'etat courant
 * de la base, sans aucune valeur simulee :
 *
 * <ul>
 *   <li>CONTRADICTION : le meme couple de briques est declare a la fois compatible
 *       et incompatible, ou une composition obligatoire impose une brique declaree
 *       incompatible avec la brique qui l'exige — aucune offre ne peut alors
 *       satisfaire les deux regles ;</li>
 *   <li>DUPLICATE : deux regles actives de meme type portent sur le meme couple ;
 *       l'une des deux est inutile et leur divergence eventuelle (bloquante ou
 *       non) rend le resultat imprevisible ;</li>
 *   <li>ARCHIVED_ITEM : une regle active designe une brique archivee ou disparue ;
 *       elle ne s'appliquera plus jamais ;</li>
 *   <li>SELF_REFERENCE : une regle porte deux fois sur la meme brique ;</li>
 *   <li>MANDATORY_CYCLE : des compositions obligatoires se referencent en boucle
 *       (A exige B, B exige A) — la boucle est satisfiable mais signale une saisie
 *       douteuse.</li>
 * </ul>
 */
@Service
public class RuleConsistencyService {

    private final BusinessRuleRepository ruleRepository;
    private final CatalogItemRepository catalogItemRepository;

    public RuleConsistencyService(BusinessRuleRepository ruleRepository,
                                  CatalogItemRepository catalogItemRepository) {
        this.ruleRepository = ruleRepository;
        this.catalogItemRepository = catalogItemRepository;
    }

    @Transactional(readOnly = true)
    public List<RuleConsistencyIssue> check() {
        List<BusinessRule> rules = ruleRepository.findAll();
        List<BusinessRule> active = rules.stream().filter(BusinessRule::isActive).toList();

        Set<UUID> itemIds = new HashSet<>();
        for (BusinessRule rule : rules) {
            itemIds.add(rule.getSourceItemId());
            itemIds.add(rule.getTargetItemId());
        }
        Map<UUID, CatalogItem> items = catalogItemRepository.findAllById(itemIds).stream()
                .collect(Collectors.toMap(CatalogItem::getId, Function.identity(), (a, b) -> a));

        List<RuleConsistencyIssue> issues = new ArrayList<>();
        issues.addAll(selfReferences(rules, items));
        issues.addAll(archivedItems(active, items));
        issues.addAll(duplicates(active, items));
        issues.addAll(contradictions(active, items));
        issues.addAll(mandatoryCycles(active, items));
        return issues;
    }

    private List<RuleConsistencyIssue> selfReferences(List<BusinessRule> rules, Map<UUID, CatalogItem> items) {
        List<RuleConsistencyIssue> issues = new ArrayList<>();
        for (BusinessRule rule : rules) {
            if (rule.getSourceItemId().equals(rule.getTargetItemId())) {
                issues.add(new RuleConsistencyIssue("SELF_REFERENCE", "ERROR", List.of(rule.getId()),
                        "La règle « " + rule.getName() + " » porte deux fois sur la même brique ("
                                + name(items, rule.getSourceItemId()) + ") : elle ne peut rien contraindre."));
            }
        }
        return issues;
    }

    private List<RuleConsistencyIssue> archivedItems(List<BusinessRule> active, Map<UUID, CatalogItem> items) {
        List<RuleConsistencyIssue> issues = new ArrayList<>();
        for (BusinessRule rule : active) {
            for (UUID itemId : List.of(rule.getSourceItemId(), rule.getTargetItemId())) {
                CatalogItem item = items.get(itemId);
                if (item == null) {
                    issues.add(new RuleConsistencyIssue("ARCHIVED_ITEM", "WARNING", List.of(rule.getId()),
                            "La règle « " + rule.getName() + " » désigne une brique qui n'existe plus ("
                                    + itemId + ") : elle ne s'appliquera jamais."));
                } else if (item.getStatus() == CatalogItemStatus.ARCHIVED) {
                    issues.add(new RuleConsistencyIssue("ARCHIVED_ITEM", "WARNING", List.of(rule.getId()),
                            "La règle « " + rule.getName() + " » désigne « " + item.getName()
                                    + " », qui est archivée : elle ne s'appliquera plus."));
                }
            }
        }
        return issues;
    }

    private List<RuleConsistencyIssue> duplicates(List<BusinessRule> active, Map<UUID, CatalogItem> items) {
        // Les regles symetriques (compatibilite, incompatibilite) portent sur un
        // couple non ordonne ; la composition obligatoire est orientee, mais deux
        // regles orientees dans le meme sens partagent aussi la cle.
        Map<String, List<BusinessRule>> byKey = new LinkedHashMap<>();
        for (BusinessRule rule : active) {
            String key = rule.getRuleType() == RuleType.MANDATORY_COMPOSITION
                    ? rule.getRuleType().name() + ":" + rule.getSourceItemId() + ">" + rule.getTargetItemId()
                    : rule.getRuleType().name() + ":" + pairKey(rule);
            byKey.computeIfAbsent(key, k -> new ArrayList<>()).add(rule);
        }
        List<RuleConsistencyIssue> issues = new ArrayList<>();
        for (List<BusinessRule> group : byKey.values()) {
            if (group.size() < 2) continue;
            BusinessRule first = group.get(0);
            boolean mixedBlocking = group.stream().map(BusinessRule::isBlocking).distinct().count() > 1;
            issues.add(new RuleConsistencyIssue("DUPLICATE", mixedBlocking ? "ERROR" : "WARNING",
                    group.stream().map(BusinessRule::getId).toList(),
                    group.size() + " règles actives de type " + label(first.getRuleType()) + " portent sur "
                            + name(items, first.getSourceItemId()) + " et " + name(items, first.getTargetItemId())
                            + " (" + names(group) + ")"
                            + (mixedBlocking
                                ? " ; l'une bloque et l'autre avertit seulement : le résultat est imprévisible."
                                : " : l'une d'elles est redondante.")));
        }
        return issues;
    }

    private List<RuleConsistencyIssue> contradictions(List<BusinessRule> active, Map<UUID, CatalogItem> items) {
        Map<String, List<BusinessRule>> compatible = new HashMap<>();
        Map<String, List<BusinessRule>> incompatible = new HashMap<>();
        for (BusinessRule rule : active) {
            if (rule.getRuleType() == RuleType.COMPATIBILITY) {
                compatible.computeIfAbsent(pairKey(rule), k -> new ArrayList<>()).add(rule);
            } else if (rule.getRuleType() == RuleType.INCOMPATIBILITY) {
                incompatible.computeIfAbsent(pairKey(rule), k -> new ArrayList<>()).add(rule);
            }
        }

        List<RuleConsistencyIssue> issues = new ArrayList<>();
        for (Map.Entry<String, List<BusinessRule>> entry : incompatible.entrySet()) {
            List<BusinessRule> compat = compatible.get(entry.getKey());
            if (compat == null) continue;
            BusinessRule sample = entry.getValue().get(0);
            List<UUID> ids = new ArrayList<>();
            entry.getValue().forEach(r -> ids.add(r.getId()));
            compat.forEach(r -> ids.add(r.getId()));
            issues.add(new RuleConsistencyIssue("CONTRADICTION", "ERROR", ids,
                    name(items, sample.getSourceItemId()) + " et " + name(items, sample.getTargetItemId())
                            + " sont déclarés à la fois compatibles (" + names(compat) + ") et incompatibles ("
                            + names(entry.getValue()) + ")."));
        }

        // Une composition obligatoire qui exige une brique incompatible avec celle
        // qui l'impose : aucune offre ne peut satisfaire les deux regles.
        for (BusinessRule rule : active) {
            if (rule.getRuleType() != RuleType.MANDATORY_COMPOSITION) continue;
            List<BusinessRule> conflict = incompatible.get(pairKey(rule));
            if (conflict == null) continue;
            List<UUID> ids = new ArrayList<>(List.of(rule.getId()));
            conflict.forEach(r -> ids.add(r.getId()));
            issues.add(new RuleConsistencyIssue("CONTRADICTION", "ERROR", ids,
                    "« " + rule.getName() + " » impose " + name(items, rule.getTargetItemId()) + " dès que "
                            + name(items, rule.getSourceItemId()) + " est présent, alors que " + names(conflict)
                            + " les déclare incompatibles : aucune offre ne peut respecter les deux."));
        }
        return issues;
    }

    private List<RuleConsistencyIssue> mandatoryCycles(List<BusinessRule> active, Map<UUID, CatalogItem> items) {
        Map<UUID, List<BusinessRule>> requires = new HashMap<>();
        for (BusinessRule rule : active) {
            if (rule.getRuleType() == RuleType.MANDATORY_COMPOSITION) {
                requires.computeIfAbsent(rule.getSourceItemId(), k -> new ArrayList<>()).add(rule);
            }
        }
        List<RuleConsistencyIssue> issues = new ArrayList<>();
        Set<String> reported = new HashSet<>();
        for (BusinessRule rule : active) {
            if (rule.getRuleType() != RuleType.MANDATORY_COMPOSITION) continue;
            for (BusinessRule back : requires.getOrDefault(rule.getTargetItemId(), List.of())) {
                if (!back.getTargetItemId().equals(rule.getSourceItemId())) continue;
                if (!reported.add(pairKey(rule))) continue;
                issues.add(new RuleConsistencyIssue("MANDATORY_CYCLE", "WARNING", List.of(rule.getId(), back.getId()),
                        name(items, rule.getSourceItemId()) + " exige " + name(items, rule.getTargetItemId())
                                + " (« " + rule.getName() + " ») et réciproquement (« " + back.getName()
                                + " ») : les deux briques ne peuvent être vendues qu'ensemble. Vérifiez que c'est voulu."));
            }
        }
        return issues;
    }

    /** Cle d'un couple non ordonne de briques. */
    private static String pairKey(BusinessRule rule) {
        String a = rule.getSourceItemId().toString();
        String b = rule.getTargetItemId().toString();
        return a.compareTo(b) <= 0 ? a + "|" + b : b + "|" + a;
    }

    private static String name(Map<UUID, CatalogItem> items, UUID id) {
        CatalogItem item = items.get(id);
        return item != null ? "« " + item.getName() + " »" : "une brique disparue";
    }

    private static String names(List<BusinessRule> rules) {
        return rules.stream().map(r -> "« " + r.getName() + " »").collect(Collectors.joining(", "));
    }

    private static String label(RuleType type) {
        return switch (type) {
            case COMPATIBILITY -> "compatibilité";
            case INCOMPATIBILITY -> "incompatibilité";
            case MANDATORY_COMPOSITION -> "composition obligatoire";
            case PACK_ONLY -> "vente en pack uniquement";
        };
    }
}
