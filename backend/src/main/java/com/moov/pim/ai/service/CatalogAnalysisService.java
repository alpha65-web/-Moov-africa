package com.moov.pim.ai.service;

import com.moov.pim.ai.api.dto.AiInsightsResponse;
import com.moov.pim.ai.api.dto.AiRecommendation;
import com.moov.pim.campaign.domain.Campaign;
import com.moov.pim.campaign.domain.CampaignStatus;
import com.moov.pim.campaign.repository.CampaignRepository;
import com.moov.pim.catalog.domain.CatalogItem;
import com.moov.pim.catalog.domain.CatalogItemStatus;
import com.moov.pim.catalog.domain.Category;
import com.moov.pim.catalog.repository.CatalogItemRepository;
import com.moov.pim.catalog.repository.CategoryRepository;
import com.moov.pim.dam.domain.ConformityStatus;
import com.moov.pim.dam.domain.MediaAsset;
import com.moov.pim.dam.repository.MediaAssetRepository;
import com.moov.pim.dam.repository.OfferMediaRepository;
import com.moov.pim.lifecycle.domain.Offer;
import com.moov.pim.lifecycle.domain.OfferStatus;
import com.moov.pim.lifecycle.repository.OfferRepository;
import com.moov.pim.rules.domain.BusinessRule;
import com.moov.pim.rules.repository.BusinessRuleRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

/**
 * Analyse la qualite du referentiel a partir des donnees reellement presentes en base.
 *
 * Chaque recommandation correspond a une regle deterministe et verifiable : le score
 * peut etre reconstitue a la main a partir des penalites retournees. Il n'y a ni
 * modele statistique, ni appel a un service externe.
 */
@Service
public class CatalogAnalysisService {

    /** En deca de ce nombre de caracteres, une description est consideree absente. */
    private static final int MIN_DESCRIPTION_LENGTH = 20;

    /** Au-dela de ce delai, une offre en validation est consideree bloquee. */
    private static final int VALIDATION_STALE_DAYS = 7;

    /** Nombre maximal d'identifiants remontes par recommandation. */
    private static final int MAX_ENTITY_IDS = 20;

    private final CatalogItemRepository catalogItemRepository;
    private final CategoryRepository categoryRepository;
    private final OfferRepository offerRepository;
    private final OfferMediaRepository offerMediaRepository;
    private final MediaAssetRepository mediaAssetRepository;
    private final CampaignRepository campaignRepository;
    private final BusinessRuleRepository businessRuleRepository;

    public CatalogAnalysisService(CatalogItemRepository catalogItemRepository,
                                  CategoryRepository categoryRepository,
                                  OfferRepository offerRepository,
                                  OfferMediaRepository offerMediaRepository,
                                  MediaAssetRepository mediaAssetRepository,
                                  CampaignRepository campaignRepository,
                                  BusinessRuleRepository businessRuleRepository) {
        this.catalogItemRepository = catalogItemRepository;
        this.categoryRepository = categoryRepository;
        this.offerRepository = offerRepository;
        this.offerMediaRepository = offerMediaRepository;
        this.mediaAssetRepository = mediaAssetRepository;
        this.campaignRepository = campaignRepository;
        this.businessRuleRepository = businessRuleRepository;
    }

    @Transactional(readOnly = true)
    public AiInsightsResponse analyse() {
        LocalDateTime now = LocalDateTime.now();

        List<CatalogItem> items = catalogItemRepository.findAll();
        List<Category> categories = categoryRepository.findAll();
        List<Offer> offers = offerRepository.findAll();
        List<MediaAsset> media = mediaAssetRepository.findAll();
        List<Campaign> campaigns = campaignRepository.findAll();
        List<BusinessRule> rules = businessRuleRepository.findAll();

        List<CatalogItem> activeItems = items.stream()
                .filter(i -> i.getStatus() == CatalogItemStatus.ACTIVE)
                .toList();

        List<AiRecommendation> recommendations = new ArrayList<>();
        List<AiInsightsResponse.ScorePenalty> penalties = new ArrayList<>();

        // 1. Elements de catalogue actifs sans description exploitable
        List<CatalogItem> withoutDescription = activeItems.stream()
                .filter(i -> isBlankOrTooShort(i.getDescription()))
                .toList();
        if (!withoutDescription.isEmpty()) {
            recommendations.add(new AiRecommendation(
                    "CATALOG_MISSING_DESCRIPTION", AiRecommendation.HIGH, "catalog",
                    "Elements de catalogue sans description",
                    withoutDescription.size() + " element(s) actif(s) n'ont pas de description d'au moins "
                            + MIN_DESCRIPTION_LENGTH + " caracteres. Cela degrade le referencement et la conversion.",
                    withoutDescription.size(), idsOf(withoutDescription.stream().map(CatalogItem::getId).toList())));
        }

        // 2. Offres publiees dont la date de fin est depassee
        List<Offer> expired = offers.stream()
                .filter(o -> o.getStatus() == OfferStatus.PUBLISHED)
                .filter(o -> o.getValidUntil() != null && o.getValidUntil().isBefore(now))
                .toList();
        if (!expired.isEmpty()) {
            recommendations.add(new AiRecommendation(
                    "OFFER_EXPIRED_STILL_PUBLISHED", AiRecommendation.HIGH, "offers",
                    "Offres expirees toujours publiees",
                    expired.size() + " offre(s) ont depasse leur date de fin mais restent au statut PUBLISHED.",
                    expired.size(), idsOf(expired.stream().map(Offer::getId).toList())));
        }

        // 3. Offres immobilisees en validation
        List<Offer> stale = offers.stream()
                .filter(o -> o.getStatus() == OfferStatus.IN_VALIDATION)
                .filter(o -> o.getUpdatedAt() != null
                        && o.getUpdatedAt().isBefore(now.minusDays(VALIDATION_STALE_DAYS)))
                .toList();
        if (!stale.isEmpty()) {
            recommendations.add(new AiRecommendation(
                    "OFFER_VALIDATION_STALE", AiRecommendation.HIGH, "offers",
                    "Offres bloquees en validation",
                    stale.size() + " offre(s) sont en validation depuis plus de "
                            + VALIDATION_STALE_DAYS + " jours sans changement.",
                    stale.size(), idsOf(stale.stream().map(Offer::getId).toList())));
        }

        // 4. Offres validees ou publiees sans aucun media associe
        List<Offer> withoutMedia = offers.stream()
                .filter(o -> o.getStatus() == OfferStatus.PUBLISHED || o.getStatus() == OfferStatus.VALIDATED)
                .filter(o -> offerMediaRepository.findByOfferIdOrderByDisplayOrderAsc(o.getId()).isEmpty())
                .toList();
        if (!withoutMedia.isEmpty()) {
            recommendations.add(new AiRecommendation(
                    "OFFER_MISSING_MEDIA", AiRecommendation.MEDIUM, "media",
                    "Offres sans visuel",
                    withoutMedia.size() + " offre(s) validees ou publiees n'ont aucun media associe.",
                    withoutMedia.size(), idsOf(withoutMedia.stream().map(Offer::getId).toList())));
        }

        // 5. Elements de catalogue non rattaches a une categorie
        List<CatalogItem> uncategorized = activeItems.stream()
                .filter(i -> i.getCategoryId() == null)
                .toList();
        if (!uncategorized.isEmpty()) {
            recommendations.add(new AiRecommendation(
                    "CATALOG_UNCATEGORIZED", AiRecommendation.MEDIUM, "categories",
                    "Elements sans categorie",
                    uncategorized.size() + " element(s) actif(s) ne sont rattaches a aucune categorie.",
                    uncategorized.size(), idsOf(uncategorized.stream().map(CatalogItem::getId).toList())));
        }

        // 6. Categories ne contenant aucun element
        List<Category> emptyCategories = categories.stream()
                .filter(c -> items.stream().noneMatch(i -> c.getId().equals(i.getCategoryId())))
                .toList();
        if (!emptyCategories.isEmpty()) {
            recommendations.add(new AiRecommendation(
                    "CATEGORY_EMPTY", AiRecommendation.LOW, "categories",
                    "Categories vides",
                    emptyCategories.size() + " categorie(s) ne contiennent aucun element de catalogue.",
                    emptyCategories.size(), idsOf(emptyCategories.stream().map(Category::getId).toList())));
        }

        // 7. Offres publiees sans metadonnees SEO
        List<Offer> withoutSeo = offers.stream()
                .filter(o -> o.getStatus() == OfferStatus.PUBLISHED)
                .filter(o -> isBlank(o.getSeoTitle()) || isBlank(o.getSeoDescription()))
                .toList();
        if (!withoutSeo.isEmpty()) {
            recommendations.add(new AiRecommendation(
                    "OFFER_MISSING_SEO", AiRecommendation.MEDIUM, "offers",
                    "Offres publiees sans SEO",
                    withoutSeo.size() + " offre(s) publiees n'ont pas de titre ou de description SEO.",
                    withoutSeo.size(), idsOf(withoutSeo.stream().map(Offer::getId).toList())));
        }

        // 8. Medias en attente de validation
        List<MediaAsset> pendingMedia = media.stream()
                .filter(m -> m.getConformityStatus() == ConformityStatus.PENDING)
                .toList();
        if (!pendingMedia.isEmpty()) {
            recommendations.add(new AiRecommendation(
                    "MEDIA_PENDING_VALIDATION", AiRecommendation.MEDIUM, "media",
                    "Medias en attente de validation",
                    pendingMedia.size() + " media(s) attendent une decision du circuit graphique.",
                    pendingMedia.size(), idsOf(pendingMedia.stream().map(MediaAsset::getId).toList())));
        }

        // 9. Regles metier desactivees
        List<BusinessRule> inactiveRules = rules.stream().filter(r -> !r.isActive()).toList();
        if (!inactiveRules.isEmpty()) {
            recommendations.add(new AiRecommendation(
                    "RULE_INACTIVE", AiRecommendation.LOW, "rules",
                    "Regles metier desactivees",
                    inactiveRules.size() + " regle(s) metier sont desactivees et n'ont aucun effet.",
                    inactiveRules.size(), idsOf(inactiveRules.stream().map(BusinessRule::getId).toList())));
        }

        // 10. Campagnes en brouillon jamais planifiees
        List<Campaign> draftCampaigns = campaigns.stream()
                .filter(c -> c.getStatus() == CampaignStatus.DRAFT && c.getScheduledAt() == null)
                .toList();
        if (!draftCampaigns.isEmpty()) {
            recommendations.add(new AiRecommendation(
                    "CAMPAIGN_NEVER_SCHEDULED", AiRecommendation.LOW, "campaigns",
                    "Campagnes jamais planifiees",
                    draftCampaigns.size() + " campagne(s) sont en brouillon sans date de diffusion.",
                    draftCampaigns.size(), idsOf(draftCampaigns.stream().map(Campaign::getId).toList())));
        }

        int score = computeScore(activeItems.size(), withoutDescription.size(), uncategorized.size(),
                offers.size(), expired.size(), withoutSeo.size(), withoutMedia.size(), penalties);

        int anomalies = recommendations.stream()
                .filter(r -> AiRecommendation.HIGH.equals(r.priority()))
                .mapToInt(AiRecommendation::impact)
                .sum();

        AiInsightsResponse.Snapshot snapshot = new AiInsightsResponse.Snapshot(
                items.size(),
                activeItems.size(),
                categories.size(),
                offers.size(),
                offers.stream().filter(o -> o.getStatus() == OfferStatus.PUBLISHED).count(),
                campaigns.size(),
                media.size(),
                rules.size());

        return new AiInsightsResponse(score, anomalies, withoutDescription.size(),
                recommendations.size(), recommendations, penalties, snapshot);
    }

    /**
     * Score sur 100 : chaque defaut retire un nombre de points proportionnel a la part
     * d'elements concernes, plafonne par le poids de son critere.
     */
    private int computeScore(int activeItems, int missingDescription, int uncategorized,
                             int offers, int expired, int missingSeo, int missingMedia,
                             List<AiInsightsResponse.ScorePenalty> penalties) {
        int score = 100;
        score -= penalty("Descriptions manquantes", missingDescription, activeItems, 25, penalties);
        score -= penalty("Elements sans categorie", uncategorized, activeItems, 10, penalties);
        score -= penalty("Offres expirees non archivees", expired, offers, 25, penalties);
        score -= penalty("Offres publiees sans SEO", missingSeo, offers, 20, penalties);
        score -= penalty("Offres sans visuel", missingMedia, offers, 20, penalties);
        return Math.max(0, score);
    }

    private int penalty(String label, int affected, int total, int weight,
                        List<AiInsightsResponse.ScorePenalty> penalties) {
        if (total == 0 || affected == 0) {
            return 0;
        }
        int points = (int) Math.round(weight * ((double) affected / total));
        if (points > 0) {
            penalties.add(new AiInsightsResponse.ScorePenalty(label, points));
        }
        return points;
    }

    private static List<UUID> idsOf(List<UUID> ids) {
        return ids.stream().limit(MAX_ENTITY_IDS).toList();
    }

    private static boolean isBlank(String value) {
        return value == null || value.isBlank();
    }

    private static boolean isBlankOrTooShort(String value) {
        return isBlank(value) || value.trim().length() < MIN_DESCRIPTION_LENGTH;
    }
}
