package com.moov.pim.ai.service;

import com.moov.pim.ai.api.dto.AiAssistantResponse;
import com.moov.pim.ai.api.dto.AiInsightsResponse;
import com.moov.pim.campaign.domain.Campaign;
import com.moov.pim.campaign.domain.CampaignStatus;
import com.moov.pim.campaign.repository.CampaignRepository;
import com.moov.pim.catalog.domain.CatalogItem;
import com.moov.pim.catalog.domain.CatalogItemStatus;
import com.moov.pim.catalog.repository.CatalogItemRepository;
import com.moov.pim.catalog.repository.CategoryRepository;
import com.moov.pim.dam.domain.ConformityStatus;
import com.moov.pim.dam.domain.MediaAsset;
import com.moov.pim.dam.repository.MediaAssetRepository;
import com.moov.pim.lifecycle.domain.Offer;
import com.moov.pim.lifecycle.domain.OfferStatus;
import com.moov.pim.lifecycle.repository.OfferRepository;
import com.moov.pim.permissions.repository.UserRepository;
import com.moov.pim.rules.repository.BusinessRuleRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.text.Normalizer;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;

/**
 * Repond aux questions posees dans l'assistant en interrogeant la base.
 *
 * Le sujet est identifie par mots-cles, puis la reponse est composee a partir des
 * comptages reels. Chaque reponse est accompagnee des chiffres qui l'ont produite,
 * afin que l'utilisateur puisse les recouper avec les autres ecrans.
 */
@Service
public class AiAssistantService {

    private static final Map<String, List<String>> TOPIC_KEYWORDS = new LinkedHashMap<>();

    static {
        TOPIC_KEYWORDS.put("quality", List.of("qualite", "score", "note", "sante", "probleme", "anomalie", "alerte"));
        TOPIC_KEYWORDS.put("offers", List.of("offre", "promotion", "publication", "validation", "workflow"));
        TOPIC_KEYWORDS.put("catalog", List.of("produit", "catalogue", "service", "pack", "article", "reference"));
        TOPIC_KEYWORDS.put("campaigns", List.of("campagne", "diffusion", "canal", "sms", "email"));
        TOPIC_KEYWORDS.put("media", List.of("media", "image", "visuel", "photo", "mediatheque"));
        TOPIC_KEYWORDS.put("categories", List.of("categorie", "arborescence", "classement", "rubrique"));
        TOPIC_KEYWORDS.put("users", List.of("utilisateur", "compte", "role", "equipe", "permission"));
        TOPIC_KEYWORDS.put("rules", List.of("regle", "compatibilite", "contrainte", "exclusion"));
    }

    private final CatalogAnalysisService catalogAnalysisService;
    private final CatalogItemRepository catalogItemRepository;
    private final CategoryRepository categoryRepository;
    private final OfferRepository offerRepository;
    private final CampaignRepository campaignRepository;
    private final MediaAssetRepository mediaAssetRepository;
    private final BusinessRuleRepository businessRuleRepository;
    private final UserRepository userRepository;

    public AiAssistantService(CatalogAnalysisService catalogAnalysisService,
                              CatalogItemRepository catalogItemRepository,
                              CategoryRepository categoryRepository,
                              OfferRepository offerRepository,
                              CampaignRepository campaignRepository,
                              MediaAssetRepository mediaAssetRepository,
                              BusinessRuleRepository businessRuleRepository,
                              UserRepository userRepository) {
        this.catalogAnalysisService = catalogAnalysisService;
        this.catalogItemRepository = catalogItemRepository;
        this.categoryRepository = categoryRepository;
        this.offerRepository = offerRepository;
        this.campaignRepository = campaignRepository;
        this.mediaAssetRepository = mediaAssetRepository;
        this.businessRuleRepository = businessRuleRepository;
        this.userRepository = userRepository;
    }

    @Transactional(readOnly = true)
    public AiAssistantResponse answer(String question) {
        String topic = detectTopic(question);
        return switch (topic) {
            case "quality" -> quality();
            case "offers" -> offers();
            case "catalog" -> catalog();
            case "campaigns" -> campaigns();
            case "media" -> media();
            case "categories" -> categories();
            case "users" -> users();
            case "rules" -> rules();
            default -> overview();
        };
    }

    private AiAssistantResponse quality() {
        AiInsightsResponse insights = catalogAnalysisService.analyse();
        StringBuilder answer = new StringBuilder();
        answer.append("Le score qualite global du referentiel est de ")
                .append(insights.qualityScore()).append("/100. ");
        if (insights.penalties().isEmpty()) {
            answer.append("Aucun point n'a ete retire : le referentiel ne presente pas de defaut mesure.");
        } else {
            answer.append("Points retires : ");
            answer.append(insights.penalties().stream()
                    .map(p -> p.label().toLowerCase(Locale.FRENCH) + " (-" + p.points() + ")")
                    .reduce((a, b) -> a + ", " + b).orElse(""));
            answer.append(". ").append(insights.recommendations().size())
                    .append(" recommandation(s) sont disponibles dans l'onglet Analyses.");
        }

        List<AiAssistantResponse.Fact> facts = new ArrayList<>();
        facts.add(new AiAssistantResponse.Fact("Score qualite", insights.qualityScore() + "/100"));
        facts.add(new AiAssistantResponse.Fact("Anomalies prioritaires", String.valueOf(insights.anomalies())));
        facts.add(new AiAssistantResponse.Fact("Recommandations", String.valueOf(insights.recommendations().size())));
        return new AiAssistantResponse("quality", answer.toString(), facts);
    }

    private AiAssistantResponse offers() {
        List<Offer> offers = offerRepository.findAll();
        long published = count(offers, OfferStatus.PUBLISHED);
        long draft = count(offers, OfferStatus.DRAFT);
        long inValidation = count(offers, OfferStatus.IN_VALIDATION);
        long inEnrichment = count(offers, OfferStatus.IN_ENRICHMENT);
        long archived = count(offers, OfferStatus.ARCHIVED);

        String answer = "Le referentiel compte " + offers.size() + " offre(s) : "
                + published + " publiee(s), " + draft + " en brouillon, "
                + inEnrichment + " en enrichissement, " + inValidation + " en validation et "
                + archived + " archivee(s)."
                + (inValidation > 0
                    ? " " + inValidation + " offre(s) attendent une decision de validation."
                    : " Aucune offre n'est en attente de validation.");

        return new AiAssistantResponse("offers", answer, List.of(
                new AiAssistantResponse.Fact("Total offres", String.valueOf(offers.size())),
                new AiAssistantResponse.Fact("Publiees", String.valueOf(published)),
                new AiAssistantResponse.Fact("Brouillons", String.valueOf(draft)),
                new AiAssistantResponse.Fact("En enrichissement", String.valueOf(inEnrichment)),
                new AiAssistantResponse.Fact("En validation", String.valueOf(inValidation)),
                new AiAssistantResponse.Fact("Archivees", String.valueOf(archived))));
    }

    private AiAssistantResponse catalog() {
        List<CatalogItem> items = catalogItemRepository.findAll();
        long active = items.stream().filter(i -> i.getStatus() == CatalogItemStatus.ACTIVE).count();
        long archived = items.size() - active;
        long withoutDescription = items.stream()
                .filter(i -> i.getStatus() == CatalogItemStatus.ACTIVE)
                .filter(i -> i.getDescription() == null || i.getDescription().trim().length() < 20)
                .count();

        String answer = "Le catalogue contient " + items.size() + " element(s), dont "
                + active + " actif(s) et " + archived + " archive(s). "
                + (withoutDescription > 0
                    ? withoutDescription + " element(s) actif(s) n'ont pas de description exploitable."
                    : "Tous les elements actifs disposent d'une description.");

        return new AiAssistantResponse("catalog", answer, List.of(
                new AiAssistantResponse.Fact("Total elements", String.valueOf(items.size())),
                new AiAssistantResponse.Fact("Actifs", String.valueOf(active)),
                new AiAssistantResponse.Fact("Archives", String.valueOf(archived)),
                new AiAssistantResponse.Fact("Sans description", String.valueOf(withoutDescription))));
    }

    private AiAssistantResponse campaigns() {
        List<Campaign> campaigns = campaignRepository.findAll();
        long draft = campaigns.stream().filter(c -> c.getStatus() == CampaignStatus.DRAFT).count();
        long scheduled = campaigns.stream().filter(c -> c.getScheduledAt() != null).count();

        String answer = campaigns.isEmpty()
                ? "Aucune campagne n'est enregistree pour le moment."
                : campaigns.size() + " campagne(s) sont enregistrees, dont " + draft
                    + " en brouillon et " + scheduled + " disposant d'une date de diffusion.";

        return new AiAssistantResponse("campaigns", answer, List.of(
                new AiAssistantResponse.Fact("Total campagnes", String.valueOf(campaigns.size())),
                new AiAssistantResponse.Fact("Brouillons", String.valueOf(draft)),
                new AiAssistantResponse.Fact("Planifiees", String.valueOf(scheduled))));
    }

    private AiAssistantResponse media() {
        List<MediaAsset> media = mediaAssetRepository.findAll();
        long pending = media.stream().filter(m -> m.getConformityStatus() == ConformityStatus.PENDING).count();
        long approved = media.stream().filter(m -> m.getConformityStatus() == ConformityStatus.COMPLIANT).count();
        long rejected = media.stream().filter(m -> m.getConformityStatus() == ConformityStatus.NON_COMPLIANT).count();

        String answer = media.isEmpty()
                ? "La mediatheque est vide : aucun media n'a encore ete depose."
                : "La mediatheque contient " + media.size() + " media(s) : " + approved
                    + " conforme(s), " + pending + " en attente de validation et " + rejected + " non conforme(s).";

        return new AiAssistantResponse("media", answer, List.of(
                new AiAssistantResponse.Fact("Total medias", String.valueOf(media.size())),
                new AiAssistantResponse.Fact("Conformes", String.valueOf(approved)),
                new AiAssistantResponse.Fact("En attente", String.valueOf(pending)),
                new AiAssistantResponse.Fact("Non conformes", String.valueOf(rejected))));
    }

    private AiAssistantResponse categories() {
        var categories = categoryRepository.findAll();
        var items = catalogItemRepository.findAll();
        long empty = categories.stream()
                .filter(c -> items.stream().noneMatch(i -> c.getId().equals(i.getCategoryId())))
                .count();
        long roots = categories.stream().filter(c -> c.getLevel() == 0).count();

        String answer = "L'arborescence compte " + categories.size() + " categorie(s), dont "
                + roots + " a la racine. "
                + (empty > 0 ? empty + " categorie(s) ne contiennent aucun element."
                             : "Chaque categorie contient au moins un element.");

        return new AiAssistantResponse("categories", answer, List.of(
                new AiAssistantResponse.Fact("Total categories", String.valueOf(categories.size())),
                new AiAssistantResponse.Fact("Racines", String.valueOf(roots)),
                new AiAssistantResponse.Fact("Vides", String.valueOf(empty))));
    }

    private AiAssistantResponse users() {
        var users = userRepository.findAll();
        Map<String, Long> byRole = new LinkedHashMap<>();
        users.forEach(u -> byRole.merge(u.getRole().getName().name(), 1L, Long::sum));

        String repartition = byRole.entrySet().stream()
                .map(e -> e.getValue() + " " + e.getKey())
                .reduce((a, b) -> a + ", " + b)
                .orElse("aucun");

        String answer = "La plateforme compte " + users.size() + " compte(s) utilisateur : " + repartition + ".";

        List<AiAssistantResponse.Fact> facts = new ArrayList<>();
        facts.add(new AiAssistantResponse.Fact("Total comptes", String.valueOf(users.size())));
        byRole.forEach((role, count) -> facts.add(new AiAssistantResponse.Fact(role, String.valueOf(count))));
        return new AiAssistantResponse("users", answer, facts);
    }

    private AiAssistantResponse rules() {
        var rules = businessRuleRepository.findAll();
        long active = rules.stream().filter(r -> r.isActive()).count();

        String answer = rules.isEmpty()
                ? "Aucune regle metier n'est configuree."
                : rules.size() + " regle(s) metier sont configurees, dont " + active
                    + " active(s) et " + (rules.size() - active) + " desactivee(s).";

        return new AiAssistantResponse("rules", answer, List.of(
                new AiAssistantResponse.Fact("Total regles", String.valueOf(rules.size())),
                new AiAssistantResponse.Fact("Actives", String.valueOf(active)),
                new AiAssistantResponse.Fact("Desactivees", String.valueOf(rules.size() - active))));
    }

    private AiAssistantResponse overview() {
        AiInsightsResponse insights = catalogAnalysisService.analyse();
        AiInsightsResponse.Snapshot s = insights.snapshot();

        String answer = "Vue d'ensemble du referentiel : " + s.catalogItems() + " element(s) de catalogue, "
                + s.offers() + " offre(s) dont " + s.publishedOffers() + " publiee(s), "
                + s.categories() + " categorie(s), " + s.mediaAssets() + " media(s) et "
                + s.campaigns() + " campagne(s). Score qualite : " + insights.qualityScore()
                + "/100. Posez une question sur les offres, le catalogue, les campagnes, les medias, "
                + "les categories, les regles metier, les utilisateurs ou la qualite pour un detail chiffre.";

        return new AiAssistantResponse("overview", answer, List.of(
                new AiAssistantResponse.Fact("Elements de catalogue", String.valueOf(s.catalogItems())),
                new AiAssistantResponse.Fact("Offres", String.valueOf(s.offers())),
                new AiAssistantResponse.Fact("Offres publiees", String.valueOf(s.publishedOffers())),
                new AiAssistantResponse.Fact("Categories", String.valueOf(s.categories())),
                new AiAssistantResponse.Fact("Medias", String.valueOf(s.mediaAssets())),
                new AiAssistantResponse.Fact("Campagnes", String.valueOf(s.campaigns())),
                new AiAssistantResponse.Fact("Score qualite", insights.qualityScore() + "/100")));
    }

    private static long count(List<Offer> offers, OfferStatus status) {
        return offers.stream().filter(o -> o.getStatus() == status).count();
    }

    /** Retire les accents et la casse afin que "categorie" et "categorie" soient reconnus. */
    private static String detectTopic(String question) {
        String normalized = Normalizer.normalize(question, Normalizer.Form.NFD)
                .replaceAll("\\p{M}", "")
                .toLowerCase(Locale.ROOT);
        for (Map.Entry<String, List<String>> entry : TOPIC_KEYWORDS.entrySet()) {
            if (entry.getValue().stream().anyMatch(normalized::contains)) {
                return entry.getKey();
            }
        }
        return "overview";
    }
}
