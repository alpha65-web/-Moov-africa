package com.moov.pim.catalog.service;

import com.moov.pim.catalog.domain.DuplicateFlag;
import com.moov.pim.catalog.domain.Product;
import com.moov.pim.catalog.repository.DuplicateFlagRepository;
import com.moov.pim.catalog.repository.ProductRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.text.Normalizer;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

/**
 * Detection des doublons a la creation d'un produit (cahier des charges 7.2).
 *
 * La table duplicate_flags et son entite existaient depuis l'origine, mais aucun
 * code ne les alimentait : la detection n'avait jamais ete ecrite. Un meme
 * terminal pouvait etre saisi deux fois sous deux libelles voisins — « Tecno
 * Spark 10 » et « TECNO Spark10 » — sans que rien ne le signale, et le catalogue
 * se dedoublait silencieusement.
 *
 * Le rapprochement est volontairement *signale* et non bloquant : deux produits
 * peuvent legitimement porter des noms voisins — deux capacites d'un meme modele,
 * par exemple. C'est au chef de produit de trancher, pas au systeme.
 */
@Service
public class DuplicateDetectionService {

    private static final Logger log = LoggerFactory.getLogger(DuplicateDetectionService.class);

    /** Au-dela de ce seuil, deux libelles sont consideres comme suspects. */
    private static final float SIMILARITY_THRESHOLD = 0.85f;

    private final ProductRepository productRepository;
    private final DuplicateFlagRepository duplicateFlagRepository;

    public DuplicateDetectionService(ProductRepository productRepository,
                                     DuplicateFlagRepository duplicateFlagRepository) {
        this.productRepository = productRepository;
        this.duplicateFlagRepository = duplicateFlagRepository;
    }

    /**
     * Rapproche un produit nouvellement cree de ceux qui existent deja et
     * enregistre les suspicions.
     *
     * @return les produits juges trop proches, pour que l'ecran puisse le signaler
     *         immediatement a son auteur plutot que d'attendre qu'il consulte la
     *         liste des rapprochements.
     */
    @Transactional
    public List<Product> flagPotentialDuplicates(Product created) {
        String reference = normalize(created.getName());
        if (reference.isBlank()) return List.of();

        List<Product> suspects = new ArrayList<>();

        for (Product existing : productRepository.findAll()) {
            if (existing.getId() == null || existing.getId().equals(created.getId())) continue;

            float similarity = similarity(reference, normalize(existing.getName()));
            if (similarity < SIMILARITY_THRESHOLD) continue;

            // Un rapprochement deja consigne ne l'est pas une seconde fois : la
            // liste des suspicions doit rester lisible.
            if (duplicateFlagRepository.existsBySourceProductIdAndDuplicateProductId(
                    created.getId(), existing.getId())) {
                continue;
            }

            duplicateFlagRepository.save(
                    new DuplicateFlag(created.getId(), existing.getId(), similarity));
            suspects.add(existing);
            log.info("Doublon suspecté : « {} » et « {} » (similarité {})",
                    created.getName(), existing.getName(), similarity);
        }
        return suspects;
    }

    /**
     * Ramene un libelle a sa forme comparable : minuscules, sans accents, sans
     * ponctuation ni espaces.
     *
     * Retirer les espaces est ce qui permet de rapprocher « Spark 10 » de
     * « Spark10 », qui est precisement la forme que prend le doublon de saisie.
     */
    static String normalize(String value) {
        if (value == null) return "";
        String withoutAccents = Normalizer.normalize(value, Normalizer.Form.NFD)
                .replaceAll("\\p{InCombiningDiacriticalMarks}+", "");
        return withoutAccents.toLowerCase().replaceAll("[^a-z0-9]", "");
    }

    /**
     * Similarite de deux libelles, entre 0 et 1.
     *
     * Une distance d'edition seule ne convient pas a un catalogue telecom : sur des
     * libelles longs, un chiffre de difference coute peu. « Forfait 5 Go » et
     * « Forfait 50 Go » ne different que d'un caractere sur onze, soit 0,91 de
     * similarite — au-dessus du seuil, alors que ce sont deux forfaits distincts.
     * Le defaut a ete revele par le test, pas par la lecture du code.
     *
     * Dans ce domaine, les chiffres portent le sens : ils designent un volume, une
     * capacite, une generation de modele. Deux libelles dont les nombres different
     * ne sont donc jamais un doublon, quelle que soit la ressemblance du reste. La
     * comparaison porte ensuite sur la seule partie alphabetique, ou une difference
     * releve bien de la variante de saisie.
     */
    static float similarity(String left, String right) {
        if (left.equals(right)) return 1f;
        if (left.isEmpty() || right.isEmpty()) return 0f;

        // Les nombres doivent coincider exactement : « Spark 10 » et « Spark 20 »
        // sont deux modeles, « 5 Go » et « 50 Go » deux forfaits.
        if (!digitsOf(left).equals(digitsOf(right))) return 0f;

        String leftLetters = lettersOf(left);
        String rightLetters = lettersOf(right);
        if (leftLetters.equals(rightLetters)) return 1f;
        if (leftLetters.isEmpty() || rightLetters.isEmpty()) return 0f;

        int distance = levenshtein(leftLetters, rightLetters);
        int longest = Math.max(leftLetters.length(), rightLetters.length());
        return 1f - ((float) distance / longest);
    }

    /** Suite des chiffres d'un libelle deja normalise, dans l'ordre d'apparition. */
    private static String digitsOf(String normalized) {
        return normalized.replaceAll("[^0-9]", "");
    }

    /** Partie alphabetique d'un libelle deja normalise. */
    private static String lettersOf(String normalized) {
        return normalized.replaceAll("[^a-z]", "");
    }

    private static int levenshtein(String left, String right) {
        int[] previous = new int[right.length() + 1];
        int[] current = new int[right.length() + 1];

        for (int j = 0; j <= right.length(); j++) previous[j] = j;

        for (int i = 1; i <= left.length(); i++) {
            current[0] = i;
            for (int j = 1; j <= right.length(); j++) {
                int substitution = previous[j - 1] + (left.charAt(i - 1) == right.charAt(j - 1) ? 0 : 1);
                current[j] = Math.min(Math.min(current[j - 1] + 1, previous[j] + 1), substitution);
            }
            int[] swap = previous;
            previous = current;
            current = swap;
        }
        return previous[right.length()];
    }

    /** Rapprochements en attente d'arbitrage. */
    @Transactional(readOnly = true)
    public List<DuplicateFlag> unresolved() {
        return duplicateFlagRepository.findByResolvedFalseOrderByCreatedAtDesc();
    }

    /**
     * Ecarte un rapprochement : les deux produits sont bien distincts.
     * La suspicion est conservee, marquee resolue, plutot que supprimee — c'est
     * une trace de decision, et elle evite qu'on rejuge indefiniment le meme cas.
     */
    @Transactional
    public void resolve(UUID flagId, UUID resolvedById) {
        DuplicateFlag flag = duplicateFlagRepository.findById(flagId)
                .orElseThrow(() -> new IllegalArgumentException("Rapprochement introuvable"));
        flag.setResolved(true);
        flag.setResolvedById(resolvedById);
        duplicateFlagRepository.save(flag);
    }
}
