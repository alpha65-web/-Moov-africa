package com.moov.pim.ai.service;

import com.moov.pim.ai.api.dto.AiGenerationRequest;
import com.moov.pim.ai.api.dto.AiGenerationResponse;
import com.moov.pim.catalog.domain.CatalogItem;
import com.moov.pim.catalog.domain.Category;
import com.moov.pim.catalog.repository.CatalogItemRepository;
import com.moov.pim.catalog.repository.CategoryRepository;
import com.moov.pim.lifecycle.domain.Offer;
import com.moov.pim.lifecycle.repository.OfferRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.text.Normalizer;
import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Set;

/**
 * Produit des descriptions, mots-cles et traductions a partir des donnees reelles
 * de l'element selectionne (nom, prix, devise, categorie).
 *
 * La generation est deterministe et sans service externe : le meme element produit
 * toujours le meme texte, ce qui la rend verifiable et utilisable hors ligne.
 */
@Service
public class ContentGenerationService {

    public static final String TYPE_DESCRIPTION = "DESCRIPTION";
    public static final String TYPE_TAGS = "TAGS";
    public static final String TYPE_TRANSLATION = "TRANSLATION";
    public static final String TYPE_SEO = "SEO";

    /** Limites usuelles d'affichage des moteurs de recherche. */
    private static final int SEO_TITLE_MAX = 60;
    private static final int SEO_DESCRIPTION_MAX = 155;

    private static final String TONE_CREATIVE = "CREATIVE";

    private final CatalogItemRepository catalogItemRepository;
    private final CategoryRepository categoryRepository;
    private final OfferRepository offerRepository;

    public ContentGenerationService(CatalogItemRepository catalogItemRepository,
                                    CategoryRepository categoryRepository,
                                    OfferRepository offerRepository) {
        this.catalogItemRepository = catalogItemRepository;
        this.categoryRepository = categoryRepository;
        this.offerRepository = offerRepository;
    }

    @Transactional(readOnly = true)
    public AiGenerationResponse generate(AiGenerationRequest request) {
        String type = normalizeType(request.type());
        String tone = TONE_CREATIVE.equalsIgnoreCase(request.tone()) ? TONE_CREATIVE : "PROFESSIONAL";
        String language = request.language() == null || request.language().isBlank()
                ? "fr" : request.language().toLowerCase(Locale.ROOT);

        Subject subject = resolveSubject(request);

        String content = switch (type) {
            case TYPE_TAGS -> generateTags(subject);
            case TYPE_TRANSLATION -> generateTranslation(subject, language, tone);
            case TYPE_SEO -> generateSeo(subject);
            default -> generateDescription(subject, tone);
        };

        String seoTitle = null;
        String seoDescription = null;
        if (TYPE_SEO.equals(type)) {
            seoTitle = seoTitle(subject);
            seoDescription = seoDescription(subject);
        }

        return new AiGenerationResponse(type, tone, language, content, subject.source(),
                seoTitle, seoDescription);
    }

    // ---------------------------------------------------------------- sujet

    /**
     * Element de reference de la generation.
     *
     * @param source origine des donnees, restituee a l'utilisateur pour tracabilite
     */
    private record Subject(String name, String description, BigDecimal price,
                           String currency, String categoryName, String source) {}

    private Subject resolveSubject(AiGenerationRequest request) {
        if (request.catalogItemId() != null) {
            CatalogItem item = catalogItemRepository.findById(request.catalogItemId())
                    .orElseThrow(() -> new IllegalArgumentException("Element de catalogue introuvable"));
            String categoryName = item.getCategoryId() == null ? null
                    : categoryRepository.findById(item.getCategoryId()).map(Category::getName).orElse(null);
            return new Subject(item.getName(), item.getDescription(), item.getBasePrice(),
                    item.getCurrency(), categoryName, "Catalogue : " + item.getName());
        }

        if (request.offerId() != null) {
            Offer offer = offerRepository.findById(request.offerId())
                    .orElseThrow(() -> new IllegalArgumentException("Offre introuvable"));
            return new Subject(offer.getName(), offer.getShortDescription(), offer.getPromotionalPrice(),
                    offer.getCurrency(), null, "Offre : " + offer.getName());
        }

        String subject = request.subject() == null || request.subject().isBlank()
                ? null : request.subject().trim();
        if (subject == null) {
            throw new IllegalArgumentException(
                    "Selectionnez un element du catalogue, une offre, ou saisissez un intitule");
        }
        return new Subject(subject, null, null, null, null, "Intitule libre : " + subject);
    }

    // ------------------------------------------------------------ generation

    private String generateDescription(Subject s, String tone) {
        String price = formatPrice(s);
        String category = s.categoryName() == null ? "" : " Retrouvez-le dans la categorie " + s.categoryName() + ".";

        if (TONE_CREATIVE.equals(tone)) {
            return s.name() + " — l'essentiel, en mieux. "
                    + (s.description() != null && !s.description().isBlank()
                        ? s.description().trim() + " "
                        : "")
                    + "Une experience pensee pour votre quotidien sur le reseau Moov Africa."
                    + (price.isEmpty() ? "" : " A partir de " + price + ".")
                    + category;
        }

        return s.name() + " — "
                + (s.description() != null && !s.description().isBlank()
                    ? s.description().trim() + " "
                    : "Offre disponible sur l'ensemble du reseau Moov Africa. ")
                + "Souscription immediate et gestion depuis votre espace client."
                + (price.isEmpty() ? "" : " Tarif : " + price + ".")
                + category;
    }

    private String generateTags(Subject s) {
        Set<String> tags = new LinkedHashSet<>();
        tags.add("moov-africa");
        for (String word : slugWords(s.name())) {
            tags.add(word);
        }
        if (s.categoryName() != null) {
            tags.addAll(slugWords(s.categoryName()));
        }
        if (s.description() != null) {
            slugWords(s.description()).stream().limit(6).forEach(tags::add);
        }
        return String.join(", ", tags.stream().limit(12).toList());
    }

    private String generateTranslation(Subject s, String language, String tone) {
        String base = generateDescription(s, tone);
        return switch (language) {
            case "en" -> s.name() + " — Available across the entire Moov Africa network. "
                    + (s.description() != null && !s.description().isBlank() ? s.description().trim() + " " : "")
                    + "Instant activation and self-care from your customer area."
                    + (formatPrice(s).isEmpty() ? "" : " Price: " + formatPrice(s) + ".");
            case "ar" -> s.name() + " — متوفر على كامل شبكة Moov Africa. "
                    + "تفعيل فوري وإدارة كاملة من حسابك."
                    + (formatPrice(s).isEmpty() ? "" : " السعر: " + formatPrice(s) + ".");
            case "sw" -> s.name() + " — Inapatikana katika mtandao wote wa Moov Africa. "
                    + "Uanzishaji wa papo hapo na usimamizi kutoka kwenye akaunti yako."
                    + (formatPrice(s).isEmpty() ? "" : " Bei: " + formatPrice(s) + ".");
            default -> base;
        };
    }

    // ------------------------------------------------------------------ seo

    /**
     * Titre de referencement et meta-description, composes a partir du nom, de la
     * categorie et du prix reels de l'element.
     *
     * Rien ne remplissait seoTitle ni seoDescription : ces deux champs existaient sur
     * les offres sans qu'aucune fonction ne les produise, et l'onglet Generation ne
     * proposait que description, mots-cles et traduction.
     *
     * Les longueurs sont bornees aux limites usuelles d'affichage des moteurs, la
     * coupure se faisant sur un mot entier pour ne pas trancher au milieu.
     */
    private String generateSeo(Subject s) {
        return "Titre : " + seoTitle(s) + System.lineSeparator()
                + "Meta-description : " + seoDescription(s);
    }

    private String seoTitle(Subject s) {
        String base = s.categoryName() == null || s.categoryName().isBlank()
                ? s.name() + " | Moov Africa"
                : s.name() + " - " + s.categoryName() + " | Moov Africa";
        return truncateOnWord(base, SEO_TITLE_MAX);
    }

    private String seoDescription(Subject s) {
        StringBuilder b = new StringBuilder();
        b.append(s.name());
        if (s.description() != null && !s.description().isBlank()) {
            b.append(" : ").append(s.description().trim());
        }
        String price = formatPrice(s);
        if (!price.isEmpty()) {
            b.append(" A partir de ").append(price).append(".");
        }
        b.append(" Souscrivez en ligne chez Moov Africa.");
        return truncateOnWord(b.toString().replaceAll("\\s+", " ").trim(), SEO_DESCRIPTION_MAX);
    }

    /** Tronque sans couper un mot, en signalant la coupure par une ellipse. */
    private static String truncateOnWord(String value, int max) {
        if (value.length() <= max) {
            return value;
        }
        String cut = value.substring(0, max - 1);
        int lastSpace = cut.lastIndexOf(' ');
        if (lastSpace > max / 2) {
            cut = cut.substring(0, lastSpace);
        }
        return cut.trim() + "\u2026";
    }

    // -------------------------------------------------------------- utilitaires

    /**
     * Un type inconnu etait silencieusement traite comme une description : l'API
     * repondait 200 avec un contenu qui n'etait pas celui demande. Elle le refuse
     * desormais, en nommant les types admis.
     */
    private static String normalizeType(String type) {
        String value = type == null ? "" : type.trim().toUpperCase(Locale.ROOT);
        return switch (value) {
            case TYPE_TAGS, TYPE_TRANSLATION, TYPE_DESCRIPTION, TYPE_SEO -> value;
            default -> throw new IllegalArgumentException(
                    "Type de generation inconnu : " + type
                            + ". Types admis : DESCRIPTION, TAGS, TRANSLATION, SEO");
        };
    }

    private static String formatPrice(Subject s) {
        if (s.price() == null || s.price().signum() <= 0) {
            return "";
        }
        return s.price().stripTrailingZeros().toPlainString()
                + " " + (s.currency() == null ? "XOF" : s.currency());
    }

    /** Decoupe un libelle en mots-cles normalises, sans accents ni mots vides. */
    private static List<String> slugWords(String value) {
        if (value == null || value.isBlank()) {
            return List.of();
        }
        String normalized = Normalizer.normalize(value, Normalizer.Form.NFD)
                .replaceAll("\\p{M}", "")
                .toLowerCase(Locale.ROOT);
        List<String> words = new ArrayList<>();
        for (String raw : normalized.split("[^a-z0-9]+")) {
            if (raw.length() >= 3 && !STOP_WORDS.contains(raw)) {
                words.add(raw);
            }
        }
        return words;
    }

    private static final Set<String> STOP_WORDS = Set.of(
            "les", "des", "une", "sur", "pour", "avec", "dans", "par", "aux", "vos", "votre",
            "est", "sont", "the", "and", "for", "with", "from", "valable", "valables");
}
