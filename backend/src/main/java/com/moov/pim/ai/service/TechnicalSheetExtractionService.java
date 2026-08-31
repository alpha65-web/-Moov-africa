package com.moov.pim.ai.service;

import com.moov.pim.ai.api.dto.SheetExtractionRequest;
import com.moov.pim.ai.api.dto.SheetExtractionResponse;
import com.moov.pim.catalog.domain.BillingCycle;
import com.moov.pim.catalog.domain.Category;
import com.moov.pim.catalog.domain.ItemType;
import com.moov.pim.catalog.domain.ServiceType;
import com.moov.pim.catalog.repository.CategoryRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Classification intelligente : lecture d'une fiche technique.
 *
 * Le cahier des charges (7.10) distingue deux fonctions d'IA a ne pas confondre.
 * La generation de contenu marketing part des caracteristiques deja saisies pour
 * produire des descriptions ; l'auto-tagging fait l'inverse — il part d'une fiche
 * technique pour en extraire « categorie, caracteristiques, tags », cote chef de
 * produit, a la creation.
 *
 * Seule la premiere existait. {@link ContentGenerationService#generate} sait
 * produire des mots-cles, mais a partir des champs deja renseignes en base : elle
 * suppose resolu le probleme qu'elle etait censee resoudre. Aucun service ne
 * lisait de document, et le chef de produit ressaisissait a la main ce que la
 * fiche technique contenait deja.
 *
 * <h2>Pourquoi une lecture par regles et non un modele de langage</h2>
 *
 * Aucun acces a un modele n'a ete ouvert pendant le projet. Les deux issues
 * honnetes etaient de retirer la fonction ou de la construire sur ce qui est
 * reellement disponible : le texte de la fiche et le referentiel de categories
 * de la plateforme. La seconde a ete retenue — elle donne un resultat verifiable,
 * sans dependance reseau susceptible de tomber pendant une demonstration, et
 * elle se controle ligne a ligne. Un mode « mock » qui inventerait des
 * caracteristiques plausibles aurait produit exactement ce qu'il faut eviter :
 * une donnee fausse presentee comme une donnee lue.
 *
 * La lecture ne remplit jamais un champ qu'elle n'a pas trouve, et elle rend
 * compte de ce qu'elle a reconnu comme de ce qu'elle a manque.
 */
@Service
public class TechnicalSheetExtractionService {

    private static final Logger log = LoggerFactory.getLogger(TechnicalSheetExtractionService.class);

    /** Montant suivi d'une devise, sous les formes rencontrees au Burkina Faso. */
    private static final Pattern PRICE = Pattern.compile(
            "(\\d[\\d\\s. ]*(?:[.,]\\d{1,2})?)\\s*(?:FCFA|F\\s?CFA|XOF|francs?\\s?CFA)",
            Pattern.CASE_INSENSITIVE);

    /** Volume de donnees : 10 Go, 500 Mo, 1,5 To. */
    private static final Pattern DATA_VOLUME = Pattern.compile(
            "(\\d+(?:[.,]\\d+)?)\\s*(Go|Mo|To|GB|MB|TB)\\b", Pattern.CASE_INSENSITIVE);

    /** Duree de validite : 30 jours, 1 mois, 24 heures. */
    private static final Pattern VALIDITY = Pattern.compile(
            "(\\d+)\\s*(jours?|mois|semaines?|heures?|h)\\b", Pattern.CASE_INSENSITIVE);

    private static final Pattern MINUTES = Pattern.compile(
            "(\\d+)\\s*(?:minutes?|min)\\b", Pattern.CASE_INSENSITIVE);

    private static final Pattern SMS = Pattern.compile(
            "(\\d+)\\s*SMS\\b", Pattern.CASE_INSENSITIVE);

    private static final Pattern THROUGHPUT = Pattern.compile(
            "(\\d+(?:[.,]\\d+)?)\\s*(Mbps|Gbps|Kbps|Mb/s|Go/s)\\b", Pattern.CASE_INSENSITIVE);

    /** Ligne « Etiquette : valeur », forme dominante des fiches techniques. */
    private static final Pattern LABELLED_LINE = Pattern.compile(
            "^\\s*[-*•]?\\s*([\\p{L}][\\p{L}\\s'()/°-]{1,40}?)\\s*[:=]\\s*(.+?)\\s*$");

    /** Etiquettes designant le nom commercial de l'element. */
    private static final Set<String> NAME_LABELS = Set.of(
            "nom", "nom commercial", "designation", "désignation", "intitule", "intitulé",
            "offre", "produit", "service", "pack", "libelle", "libellé", "titre");

    /** Etiquettes a ne pas reprendre comme caracteristique : elles sont deja des champs. */
    private static final Set<String> STRUCTURAL_LABELS = Set.of(
            "nom", "nom commercial", "designation", "désignation", "intitule", "intitulé",
            "offre", "produit", "service", "pack", "libelle", "libellé", "titre",
            "prix", "tarif", "montant", "cout", "coût", "categorie", "catégorie");

    /** Mots trop courants pour distinguer un element d'un autre. */
    private static final Set<String> STOP_WORDS = Set.of(
            "avec", "sans", "pour", "dans", "chez", "vers", "plus", "tout", "tous", "toute",
            "cette", "votre", "notre", "leur", "les", "des", "une", "aux", "par", "sur", "est",
            "sont", "que", "qui", "quoi", "dont", "mais", "donc", "car", "puis", "the", "and",
            "offre", "produit", "service", "pack", "client", "clients", "fiche", "technique");

    private final CategoryRepository categoryRepository;

    public TechnicalSheetExtractionService(CategoryRepository categoryRepository) {
        this.categoryRepository = categoryRepository;
    }

    @Transactional(readOnly = true)
    public SheetExtractionResponse extract(SheetExtractionRequest request) {
        String content = request.content();
        List<String> lines = content.lines().map(String::strip).filter(l -> !l.isEmpty()).toList();
        String lowered = content.toLowerCase(Locale.ROOT);
        List<String> notes = new ArrayList<>();

        Map<String, String> labelled = labelledValues(lines);

        ItemType itemType = resolveItemType(request.itemType());
        String name = extractName(labelled, lines, notes);
        BigDecimal price = extractPrice(content, notes);
        ServiceType serviceType = detectServiceType(lowered);
        BillingCycle billingCycle = detectBillingCycle(lowered);

        List<String> characteristics = extractCharacteristics(labelled, content, notes);
        Category category = matchCategory(itemType, content, name, notes);
        List<String> tags = buildTags(name, characteristics, serviceType, lowered);

        if (serviceType != null) {
            notes.add("Nature reconnue : " + serviceType.name().toLowerCase(Locale.ROOT).replace('_', ' '));
        }
        if (billingCycle == null) {
            notes.add("Aucune périodicité de facturation reconnue dans la fiche");
        }

        log.info("Fiche technique lue : {} caractéristique(s), {} mot(s)-clé(s), catégorie {}",
                characteristics.size(), tags.size(),
                category == null ? "non déterminée" : category.getName());

        return new SheetExtractionResponse(
                name,
                itemType == null ? null : itemType.name(),
                serviceType == null ? null : serviceType.name(),
                billingCycle == null ? null : billingCycle.name(),
                price,
                price == null ? null : "XOF",
                category == null ? null : category.getId(),
                category == null ? null : categoryPath(category),
                characteristics.isEmpty() ? null : String.join("\n", characteristics),
                tags,
                notes);
    }

    // ------------------------------------------------------------------ nom

    /**
     * Nom commercial.
     *
     * Une etiquette explicite prime toujours. A defaut, la premiere ligne d'une
     * fiche technique en porte presque toujours le titre — mais seulement si elle
     * ne ressemble pas deja a une caracteristique, sans quoi « Volume : 10 Go »
     * deviendrait le nom de l'element.
     */
    private String extractName(Map<String, String> labelled, List<String> lines, List<String> notes) {
        for (String label : NAME_LABELS) {
            String value = labelled.get(label);
            if (value != null && !value.isBlank()) {
                return trim(value, 120);
            }
        }
        for (String line : lines) {
            if (!LABELLED_LINE.matcher(line).matches() && line.length() >= 3 && line.length() <= 120) {
                notes.add("Nom déduit de la première ligne du document, à confirmer");
                return trim(line, 120);
            }
        }
        notes.add("Aucun nom reconnu dans la fiche");
        return null;
    }

    // ---------------------------------------------------------------- prix

    private BigDecimal extractPrice(String content, List<String> notes) {
        Matcher matcher = PRICE.matcher(content);
        if (!matcher.find()) {
            notes.add("Aucun prix en francs CFA reconnu dans la fiche");
            return null;
        }
        String raw = matcher.group(1)
                .replace(" ", "")
                .replace(" ", "")
                .replace(".", "")
                .replace(",", ".");
        try {
            BigDecimal price = new BigDecimal(raw);
            notes.add("Prix reconnu : " + matcher.group().strip());
            return price;
        } catch (NumberFormatException e) {
            notes.add("Un montant a été repéré mais n'a pas pu être interprété : " + matcher.group().strip());
            return null;
        }
    }

    // ------------------------------------------------------------- nature

    /**
     * Nature du service, deduite du vocabulaire de la fiche.
     *
     * L'ordre compte : une fiche de forfait mixte cite souvent des SMS et des
     * minutes en complement d'un volume de donnees, et c'est bien la data qui la
     * caracterise. Le mobile money, lui, ne se confond avec rien.
     */
    private ServiceType detectServiceType(String lowered) {
        if (containsAny(lowered, "mobile money", "transfert d'argent", "porte-monnaie",
                "portefeuille électronique", "paiement marchand", "flooz")) {
            return ServiceType.MOBILE_MONEY;
        }
        if (containsAny(lowered, "internet", "data", "go ", "mo ", "mbps", "4g", "5g", "fibre",
                "navigation", "connexion")) {
            return ServiceType.DATA;
        }
        if (containsAny(lowered, "appel", "minute", "voix", "sms", "communication")) {
            return ServiceType.VOICE;
        }
        return null;
    }

    private BillingCycle detectBillingCycle(String lowered) {
        if (containsAny(lowered, "par mois", "mensuel", "/mois", "30 jours")) return BillingCycle.MONTHLY;
        if (containsAny(lowered, "par semaine", "hebdomadaire", "/semaine", "7 jours")) return BillingCycle.WEEKLY;
        if (containsAny(lowered, "par jour", "journalier", "quotidien", "/jour", "24 heures", "24h")) {
            return BillingCycle.DAILY;
        }
        if (containsAny(lowered, "paiement unique", "achat unique", "une seule fois", "non renouvelable")) {
            return BillingCycle.ONE_TIME;
        }
        return null;
    }

    // ------------------------------------------------------ caracteristiques

    /**
     * Caracteristiques techniques.
     *
     * Deux sources complementaires. Les lignes etiquetees donnent la structure
     * voulue par le redacteur de la fiche et sont reprises telles quelles. Les
     * grandeurs reconnues dans le texte courant — volume, validite, minutes, SMS,
     * debit — rattrapent les fiches redigees en paragraphes, ou rien n'est
     * etiquete mais ou tout est dit.
     */
    private List<String> extractCharacteristics(Map<String, String> labelled, String content,
                                                List<String> notes) {
        LinkedHashSet<String> characteristics = new LinkedHashSet<>();

        labelled.forEach((label, value) -> {
            if (!STRUCTURAL_LABELS.contains(label) && !value.isBlank()) {
                characteristics.add(capitalize(label) + " : " + trim(value, 200));
            }
        });

        addFirstMatch(characteristics, DATA_VOLUME, content, "Volume de données");
        addFirstMatch(characteristics, MINUTES, content, "Minutes d'appel");
        addFirstMatch(characteristics, SMS, content, "SMS inclus");
        addFirstMatch(characteristics, THROUGHPUT, content, "Débit");
        addFirstMatch(characteristics, VALIDITY, content, "Validité");

        if (characteristics.isEmpty()) {
            notes.add("Aucune caractéristique technique reconnue : "
                    + "la fiche ne comporte ni ligne étiquetée « Libellé : valeur » ni grandeur chiffrée");
        } else {
            notes.add(characteristics.size() + " caractéristique(s) extraite(s) de la fiche");
        }
        return new ArrayList<>(characteristics);
    }

    /**
     * N'ajoute une grandeur que si son etiquette n'a pas deja ete donnee par le
     * redacteur : reprendre « Volume : 10 Go » puis « Volume de donnees : 10 Go »
     * ferait doublon dans la fiche produite.
     */
    private void addFirstMatch(LinkedHashSet<String> into, Pattern pattern, String content, String label) {
        boolean alreadyDescribed = into.stream()
                .anyMatch(line -> line.toLowerCase(Locale.ROOT)
                        .startsWith(label.split(" ")[0].toLowerCase(Locale.ROOT)));
        if (alreadyDescribed) {
            return;
        }
        Matcher matcher = pattern.matcher(content);
        if (matcher.find()) {
            into.add(label + " : " + matcher.group().strip());
        }
    }

    // ---------------------------------------------------------- categorie

    /**
     * Categorie du referentiel la plus proche du contenu de la fiche.
     *
     * Le rapprochement se fait sur les categories reellement enregistrees, et
     * bornees au type demande : une categorie appartient a un et un seul type, et
     * proposer « Forfaits Data » pour un routeur serait une classification fausse.
     * Les sous-categories priment a score egal — c'est le niveau le plus precis
     * qui range utilement l'element.
     */
    private Category matchCategory(ItemType itemType, String content, String name, List<String> notes) {
        if (itemType == null) {
            notes.add("Type non précisé : aucune catégorie n'a pu être proposée");
            return null;
        }
        List<Category> candidates = categoryRepository.findByTypeOrderByNameAsc(itemType).stream()
                .filter(Category::isActive)
                .toList();
        if (candidates.isEmpty()) {
            notes.add("Aucune catégorie active n'existe pour le type " + itemType.name());
            return null;
        }

        Set<String> haystack = words(content + " " + (name == null ? "" : name));

        Category best = null;
        int bestScore = 0;
        for (Category candidate : candidates) {
            int score = 0;
            for (String word : words(candidate.getName())) {
                if (haystack.contains(word)) {
                    score += 2;
                }
            }
            if (candidate.getDescription() != null) {
                for (String word : words(candidate.getDescription())) {
                    if (haystack.contains(word)) {
                        score += 1;
                    }
                }
            }
            if (score == 0) {
                continue;
            }
            // A score egal, la sous-categorie l'emporte : elle range plus finement.
            boolean better = score > bestScore
                    || (score == bestScore && best != null && candidate.getLevel() > best.getLevel());
            if (better) {
                best = candidate;
                bestScore = score;
            }
        }

        if (best == null) {
            notes.add("Aucune catégorie du référentiel ne correspond au vocabulaire de la fiche");
        } else {
            notes.add("Catégorie proposée par rapprochement avec le référentiel : " + best.getName());
        }
        return best;
    }

    private String categoryPath(Category category) {
        return category.getParent() == null
                ? category.getName()
                : category.getParent().getName() + " › " + category.getName();
    }

    // ---------------------------------------------------------------- tags

    /**
     * Mots-cles de classement.
     *
     * Ils viennent de ce qui a ete reconnu — nature du service, grandeurs
     * relevees — et des mots distinctifs du nom, jamais d'un vocabulaire
     * generique ajoute pour faire nombre.
     */
    private List<String> buildTags(String name, List<String> characteristics,
                                   ServiceType serviceType, String lowered) {
        LinkedHashSet<String> tags = new LinkedHashSet<>();

        if (serviceType != null) {
            tags.add(serviceType.name().toLowerCase(Locale.ROOT).replace('_', '-'));
        }
        if (containsAny(lowered, "illimit")) tags.add("illimité");
        if (containsAny(lowered, "promo", "réduction", "remise")) tags.add("promotion");
        if (containsAny(lowered, "entreprise", "professionnel", "b2b", "pme")) tags.add("entreprise");
        if (containsAny(lowered, "étudiant", "jeune")) tags.add("jeune");
        if (containsAny(lowered, "roaming", "international", "étranger")) tags.add("international");
        if (containsAny(lowered, "fibre", "adsl", "domicile", "box")) tags.add("fixe");

        for (String characteristic : characteristics) {
            Matcher volume = DATA_VOLUME.matcher(characteristic);
            if (volume.find()) {
                tags.add(volume.group().replace(" ", "").toLowerCase(Locale.ROOT));
            }
        }

        if (name != null) {
            words(name).stream()
                    .filter(word -> word.length() > 3)
                    .limit(3)
                    .forEach(tags::add);
        }
        return new ArrayList<>(tags);
    }

    // ------------------------------------------------------------- outillage

    private Map<String, String> labelledValues(List<String> lines) {
        Map<String, String> values = new java.util.LinkedHashMap<>();
        for (String line : lines) {
            Matcher matcher = LABELLED_LINE.matcher(line);
            if (matcher.matches()) {
                values.putIfAbsent(
                        matcher.group(1).strip().toLowerCase(Locale.ROOT),
                        matcher.group(2).strip());
            }
        }
        return values;
    }

    private ItemType resolveItemType(String raw) {
        if (raw == null || raw.isBlank()) {
            return null;
        }
        try {
            return ItemType.parse(raw);
        } catch (IllegalArgumentException e) {
            return null;
        }
    }

    private Set<String> words(String value) {
        return Arrays.stream(value.toLowerCase(Locale.ROOT).split("[^\\p{L}\\p{N}]+"))
                .filter(word -> word.length() > 2)
                .filter(word -> !STOP_WORDS.contains(word))
                .collect(java.util.stream.Collectors.toCollection(LinkedHashSet::new));
    }

    private static boolean containsAny(String haystack, String... needles) {
        for (String needle : needles) {
            if (haystack.contains(needle)) {
                return true;
            }
        }
        return false;
    }

    private static String capitalize(String value) {
        return value.isEmpty() ? value : Character.toUpperCase(value.charAt(0)) + value.substring(1);
    }

    private static String trim(String value, int max) {
        String cleaned = value.strip();
        return cleaned.length() > max ? cleaned.substring(0, max) : cleaned;
    }
}
