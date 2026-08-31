package com.moov.pim.lifecycle.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.datatype.jsr310.JavaTimeModule;
import com.moov.pim.catalog.domain.Category;
import com.moov.pim.catalog.domain.ItemType;
import com.moov.pim.catalog.repository.CategoryRepository;
import com.moov.pim.lifecycle.api.dto.AnalystWorkloadResponse;
import com.moov.pim.lifecycle.api.dto.AssignOfferRequest;
import com.moov.pim.lifecycle.api.dto.CreateOfferRequest;
import com.moov.pim.lifecycle.api.dto.EnrichOfferRequest;
import com.moov.pim.lifecycle.api.dto.OfferHistoryEntryResponse;
import com.moov.pim.lifecycle.api.dto.OfferVersionResponse;
import com.moov.pim.lifecycle.api.dto.OfferResponse;
import com.moov.pim.lifecycle.api.dto.OfferStatsResponse;
import com.moov.pim.lifecycle.api.dto.StatusTransitionRequest;
import com.moov.pim.lifecycle.api.dto.UpdateOfferRequest;
import com.moov.pim.lifecycle.domain.Offer;
import com.moov.pim.lifecycle.domain.OfferItem;
import com.moov.pim.lifecycle.domain.OfferStatus;
import com.moov.pim.lifecycle.domain.OfferStatusHistory;
import com.moov.pim.lifecycle.domain.OfferVersion;
import com.moov.pim.lifecycle.repository.OfferRepository;
import com.moov.pim.permissions.domain.AccountStatus;
import com.moov.pim.rules.api.dto.RuleViolation;
import com.moov.pim.rules.service.RuleEvaluationService;
import com.moov.pim.rules.service.RuleViolationException;
import com.moov.pim.permissions.domain.User;
import com.moov.pim.permissions.repository.UserRepository;
import com.moov.pim.permissions.security.CustomUserDetails;
import com.moov.pim.shared.event.OfferAssignedEvent;
import com.moov.pim.shared.event.OfferCreatedEvent;
import com.moov.pim.shared.event.OfferPublishedEvent;
import com.moov.pim.shared.workflow.GraphicValidationGate;
import com.moov.pim.shared.event.OfferTransitionEvent;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.Collection;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

@Service
public class OfferService {

    private static final Map<OfferStatus, Set<OfferStatus>> ALLOWED_TRANSITIONS = Map.of(
            OfferStatus.DRAFT, Set.of(OfferStatus.IN_ENRICHMENT),
            OfferStatus.IN_ENRICHMENT, Set.of(OfferStatus.IN_VALIDATION, OfferStatus.DRAFT),
            OfferStatus.IN_VALIDATION, Set.of(OfferStatus.VALIDATED, OfferStatus.IN_ENRICHMENT),
            OfferStatus.VALIDATED, Set.of(OfferStatus.PLANNED, OfferStatus.PUBLISHED),
            OfferStatus.PLANNED, Set.of(OfferStatus.PUBLISHED, OfferStatus.SUSPENDED),
            OfferStatus.PUBLISHED, Set.of(OfferStatus.SUSPENDED, OfferStatus.OBSOLETE, OfferStatus.WITHDRAWN),
            OfferStatus.SUSPENDED, Set.of(OfferStatus.PUBLISHED, OfferStatus.WITHDRAWN),
            OfferStatus.OBSOLETE, Set.of(OfferStatus.ARCHIVED),
            OfferStatus.WITHDRAWN, Set.of(OfferStatus.ARCHIVED)
    );

    private final OfferRepository offerRepository;
    private final ApplicationEventPublisher eventPublisher;

    /**
     * Etat du circuit de validation graphique. Le cycle de vie ne sait pas ce
     * qu'est un visuel approuve : il pose la question au module qui le sait.
     */
    private final GraphicValidationGate graphicValidationGate;
    private final UserRepository userRepository;
    private final RuleEvaluationService ruleEvaluationService;
    private final CategoryRepository categoryRepository;

    public OfferService(OfferRepository offerRepository, ApplicationEventPublisher eventPublisher,
                        UserRepository userRepository, RuleEvaluationService ruleEvaluationService,
                        CategoryRepository categoryRepository,
                        GraphicValidationGate graphicValidationGate) {
        this.offerRepository = offerRepository;
        this.eventPublisher = eventPublisher;
        this.userRepository = userRepository;
        this.ruleEvaluationService = ruleEvaluationService;
        this.categoryRepository = categoryRepository;
        this.graphicValidationGate = graphicValidationGate;
    }

    /**
     * Verifie que la categorie visee classe bien des offres.
     *
     * Le controle vit ici et non seulement dans l'interface : une requete envoyee
     * directement a l'API — depuis Postman ou tout autre client — avec la categorie
     * « Équipements » doit etre refusee comme si elle venait du formulaire. La base
     * pose le meme invariant par une cle etrangere composite (migration V044) ;
     * cette garde existe pour rendre l'erreur intelligible plutot que technique.
     *
     * @return la categorie resolue, pour en tirer le chemin de classement
     */
    private Category checkOfferCategory(UUID categoryId) {
        Category category = categoryRepository.findById(categoryId)
                .orElseThrow(() -> new IllegalArgumentException("Catégorie introuvable"));

        if (category.getType() != ItemType.OFFER) {
            throw new IllegalArgumentException(
                    "La catégorie « " + categoryPath(category) + " » est de type "
                            + category.getType().getLabel()
                            + " : elle ne peut pas classer une offre commerciale");
        }
        if (!category.isActive()) {
            throw new IllegalStateException(
                    "La catégorie « " + categoryPath(category) + " » est désactivée "
                            + "et ne peut plus recevoir de nouvelle offre");
        }
        return category;
    }

    /** Chemin de classement lisible : « Internet mobile / Forfaits Data ». */
    private static String categoryPath(Category category) {
        if (category == null) return null;
        Category parent = category.getParent();
        return parent != null ? parent.getName() + " / " + category.getName() : category.getName();
    }

    /** Chemins de classement d'un lot d'offres, resolus en une seule requete. */
    private Map<UUID, String> resolveCategoryPaths(Collection<Offer> offers) {
        Set<UUID> ids = offers.stream()
                .map(Offer::getCategoryId)
                .filter(java.util.Objects::nonNull)
                .collect(java.util.stream.Collectors.toSet());
        if (ids.isEmpty()) return Map.of();

        Map<UUID, String> paths = new LinkedHashMap<>();
        for (Category category : categoryRepository.findAllById(ids)) {
            paths.put(category.getId(), categoryPath(category));
        }
        return paths;
    }

    /** Projette une offre isolee en resolvant son chemin de classement. */
    private OfferResponse project(Offer offer) {
        return OfferResponse.from(offer, Map.of(), resolveCategoryPaths(List.of(offer)));
    }

    /**
     * Refuse une composition qui viole une regle bloquante.
     *
     * Le module des regles metier existait mais n'etait invoque nulle part : les
     * contraintes saisies a l'ecran n'avaient aucun effet, et un chef de produit
     * pouvait assembler une offre convergente sans composante Mobile Money ou
     * reunir deux produits declares incompatibles. Le cahier des charges (7.3)
     * exige que le systeme bloque ou avertisse *avant* la soumission : le controle
     * est donc pose des la creation et a chaque modification de la composition,
     * puis une derniere fois au moment de soumettre.
     *
     * Les violations non bloquantes ne sont pas perdues : elles ne refusent pas
     * l'enregistrement, et l'ecran les affiche comme avertissements.
     */
    private void checkComposition(java.util.Collection<UUID> composition) {
        List<RuleViolation> blocking =
                ruleEvaluationService.blockingOnly(ruleEvaluationService.evaluate(composition));
        if (!blocking.isEmpty()) {
            throw new RuleViolationException(blocking);
        }
    }

    /**
     * Score de completude de la fiche, sur 100.
     *
     * Le champ existait sur l'entite et l'interface en affichait une barre de
     * progression sur chaque ligne d'offre, mais aucun code ne l'avait jamais
     * calcule : il valait zero pour toutes les offres, et la barre etait donc
     * uniformement rouge — un indicateur qui affiche la meme valeur pour tout le
     * monde n'informe de rien.
     *
     * La ponderation suit l'ordre du circuit : les champs commerciaux, qui
     * conditionnent la soumission, pesent plus que l'habillage editorial, qui
     * arrive ensuite. Le score est recalcule a chaque ecriture sur la fiche, de
     * sorte qu'il reflete toujours l'etat courant et jamais un etat passe.
     */
    private static float computeQualityScore(Offer offer) {
        int score = 0;

        // Socle commercial — 55 points
        if (isFilled(offer.getName())) score += 10;
        if (offer.getPromotionalPrice() != null) score += 10;
        if (offer.getValidFrom() != null) score += 5;
        if (offer.getValidUntil() != null) score += 5;
        if (offer.getTargetSegment() != null) score += 5;
        if (offer.getCustomerType() != null) score += 5;
        if (!offer.getItems().isEmpty()) score += 15;

        // Habillage editorial — 35 points
        if (isFilled(offer.getShortDescription())) score += 10;
        if (isFilled(offer.getLongDescription())) score += 10;
        if (isFilled(offer.getSeoTitle())) score += 7;
        if (isFilled(offer.getSeoDescription())) score += 8;

        // Conformite — 10 points
        if (isFilled(offer.getLegalMentions())) score += 10;

        return score;
    }

    private static boolean isFilled(String value) {
        return value != null && !value.isBlank();
    }

    /**
     * Confie l'enrichissement d'une offre a un analyste marketing precis.
     *
     * Sans cette designation, la notification « Enrichissement requis » partait
     * vers tous les detenteurs de OFFER_ENRICH et le premier arrive traitait la
     * fiche : le travail pouvait etre fait deux fois, et aucun responsable n'etait
     * identifiable. L'affectation ne touche pas au statut — elle se pose a tout
     * moment, sans retarder le circuit.
     *
     * La cible est verifiee : on ne confie pas une fiche a un compte qui ne sait
     * pas l'enrichir. Un identifiant nul libere l'offre.
     */
    @Transactional
    public OfferResponse assign(UUID offerId, AssignOfferRequest request) {
        Offer offer = findOffer(offerId);

        if (request.analystId() == null) {
            offer.setAssignedToId(null);
            Offer released = offerRepository.save(offer);
            eventPublisher.publishEvent(new OfferAssignedEvent(
                    released.getId(), released.getName(), null, currentUserId()));
            return project(released);
        }

        User analyst = userRepository.findById(request.analystId())
                .orElseThrow(() -> new IllegalArgumentException("Compte introuvable"));

        boolean canEnrich = analyst.getRole() != null
                && analyst.getRole().getPermissions().stream()
                        .anyMatch(permission -> "OFFER_ENRICH".equals(permission.getCode()));
        if (!canEnrich) {
            throw new IllegalArgumentException(
                    "Ce compte ne peut pas enrichir une offre : seul un analyste marketing "
                            + "detient la permission necessaire.");
        }

        offer.setAssignedToId(analyst.getId());
        Offer assigned = offerRepository.save(offer);
        eventPublisher.publishEvent(new OfferAssignedEvent(
                assigned.getId(), assigned.getName(), analyst.getId(), currentUserId()));
        return project(assigned);
    }

    /**
     * Analystes marketing disponibles, avec leur charge de travail reelle.
     *
     * Le chef de service repartit les fiches « en fonction de leur disponibilite » :
     * la liste ne peut donc pas se limiter aux noms. La charge affichee est comptee
     * sur les offres reellement confiees a chacun et encore ouvertes — celles au
     * statut En enrichissement — et non sur une declaration de disponibilite, qui
     * serait vite fausse. Le total traite donne le second element de decision :
     * distinguer un analyste momentanement libre d'un analyste jamais sollicite.
     */
    @Transactional(readOnly = true)
    public List<AnalystWorkloadResponse> listEnrichersWithWorkload() {
        return userRepository
                .findAssignableByPermissionCodeAndStatus("OFFER_ENRICH", AccountStatus.ACTIVE)
                .stream()
                .map(analyst -> new AnalystWorkloadResponse(
                        analyst.getId(),
                        analyst.getFirstName(),
                        analyst.getLastName(),
                        offerRepository.countByAssignedToIdAndStatus(
                                analyst.getId(), OfferStatus.IN_ENRICHMENT),
                        offerRepository.countByAssignedToId(analyst.getId())))
                .sorted(Comparator.comparingLong(AnalystWorkloadResponse::activeCount))
                .toList();
    }

    @Transactional
    public OfferResponse create(CreateOfferRequest request) {
        checkOfferCategory(request.categoryId());

        Offer offer = new Offer();
        offer.setName(request.name());
        offer.setCategoryId(request.categoryId());
        offer.setShortDescription(request.shortDescription());
        offer.setLongDescription(request.longDescription());
        offer.setPromotionalPrice(request.promotionalPrice());
        if (request.currency() != null && !request.currency().isBlank()) {
            offer.setCurrency(request.currency());
        }
        offer.setValidFrom(request.validFrom());
        offer.setValidUntil(request.validUntil());
        offer.setTargetSegment(request.targetSegment());
        offer.setCustomerType(request.customerType());
        offer.setLegalMentions(request.legalMentions());
        offer.setCreatedById(currentUserId());

        if (request.catalogItemIds() != null) {
            // Controle avant enregistrement : une composition interdite ne doit pas
            // exister en base, meme au statut brouillon.
            checkComposition(request.catalogItemIds());
            for (UUID catalogItemId : request.catalogItemIds()) {
                offer.addItem(new OfferItem(catalogItemId));
            }
        }

        offer.setQualityScore(computeQualityScore(offer));
        offer = offerRepository.save(offer);
        eventPublisher.publishEvent(new OfferCreatedEvent(offer.getId(), offer.getName(), currentUserId()));
        return project(offer);
    }

    /**
     * Statuts ou les champs commerciaux restent modifiables par leur proprietaire.
     *
     * La correction apres rejet doit rester possible : le chef de service renvoie
     * une offre en enrichissement ou en brouillon, et le chef de produit doit
     * pouvoir reprendre sa fiche. Au-dela de VALIDEE en revanche, la decision a ete
     * prise sur la base de ces valeurs : les changer ensuite reviendrait a modifier
     * une offre approuvee sans repasser par le circuit.
     */
    private static final Set<OfferStatus> COMMERCIALLY_EDITABLE = Set.of(
            OfferStatus.DRAFT, OfferStatus.IN_ENRICHMENT, OfferStatus.IN_VALIDATION);

    @Transactional
    public OfferResponse update(UUID offerId, UpdateOfferRequest request) {
        Offer offer = findOffer(offerId);
        checkOwnership(offer);

        if (!COMMERCIALLY_EDITABLE.contains(offer.getStatus())) {
            throw new IllegalStateException(
                    "Une offre " + offer.getStatus() + " ne peut plus etre modifiee : "
                            + "elle a deja ete validee. Repassez par le circuit de validation.");
        }

        // Le reclassement n'est applique que s'il est demande : une requete qui ne
        // porte que sur le prix ne doit pas declasser l'offre.
        if (request.categoryId() != null) {
            checkOfferCategory(request.categoryId());
            offer.setCategoryId(request.categoryId());
        }

        offer.setName(request.name());
        offer.setPromotionalPrice(request.promotionalPrice());
        if (request.currency() != null && !request.currency().isBlank()) {
            offer.setCurrency(request.currency());
        }
        offer.setValidFrom(request.validFrom());
        offer.setValidUntil(request.validUntil());
        offer.setTargetSegment(request.targetSegment());
        offer.setCustomerType(request.customerType());
        offer.setLegalMentions(request.legalMentions());

        // La composition n'est remplacee que si elle est fournie : une requete qui
        // ne s'interesse qu'au prix ne doit pas vider les briques de l'offre.
        if (request.catalogItemIds() != null) {
            checkComposition(request.catalogItemIds());
            offer.getItems().clear();
            for (UUID catalogItemId : request.catalogItemIds()) {
                offer.addItem(new OfferItem(catalogItemId));
            }
        }

        offer.setQualityScore(computeQualityScore(offer));
        offer = offerRepository.save(offer);
        return project(offer);
    }

    @Transactional
    public OfferResponse enrich(UUID offerId, EnrichOfferRequest request) {
        Offer offer = findOffer(offerId);
        checkOwnership(offer);

        if (offer.getStatus() != OfferStatus.IN_ENRICHMENT && offer.getStatus() != OfferStatus.DRAFT) {
            throw new IllegalStateException("L'offre doit être en brouillon ou en enrichissement pour être enrichie");
        }

        if (request.shortDescription() != null) offer.setShortDescription(request.shortDescription());
        if (request.longDescription() != null) offer.setLongDescription(request.longDescription());
        if (request.seoTitle() != null) offer.setSeoTitle(request.seoTitle());
        if (request.seoDescription() != null) offer.setSeoDescription(request.seoDescription());
        if (request.legalMentions() != null) offer.setLegalMentions(request.legalMentions());

        offer.setEnrichedById(currentUserId());
        offer.setQualityScore(computeQualityScore(offer));
        offer = offerRepository.save(offer);
        return project(offer);
    }

    @Transactional
    public OfferResponse transition(UUID offerId, StatusTransitionRequest request) {
        Offer offer = findOffer(offerId);
        checkOwnership(offer);
        OfferStatus from = offer.getStatus();
        OfferStatus to = request.targetStatus();

        checkTransitionPermission(from, to);

        Set<OfferStatus> allowed = ALLOWED_TRANSITIONS.getOrDefault(from, Set.of());
        if (!allowed.contains(to)) {
            throw new IllegalStateException(
                    "Transition interdite : " + from + " → " + to);
        }

        if ((to == OfferStatus.IN_ENRICHMENT || to == OfferStatus.IN_VALIDATION) && from == OfferStatus.IN_VALIDATION
                && (request.comment() == null || request.comment().isBlank())) {
            throw new IllegalArgumentException("Un commentaire est obligatoire en cas de rejet");
        }

        // Enchainement des deux circuits, cahier des charges 7.6 : « une fois la
        // validation graphique obtenue, l'offre poursuit vers la validation
        // generale ». Il n'existait pas — une offre partait en validation metier
        // avec des visuels encore en attente, voire rejetes, et le chef de
        // departement validait une fiche que le chef de service n'avait pas
        // approuvee. Le controle ne porte que sur des visuels reellement deposes :
        // une offre sans media n'a rien a faire valider graphiquement.
        if (to == OfferStatus.IN_VALIDATION) {
            graphicValidationGate.blockingReason(offer.getId()).ifPresent(reason -> {
                throw new IllegalStateException(reason);
            });
        }

        // Derniere barriere avant que la fiche ne quitte les mains de son auteur.
        // La composition a pu devenir invalide depuis sa saisie : une regle peut
        // avoir ete creee entre-temps, ou un element du catalogue archive.
        if (to == OfferStatus.IN_ENRICHMENT && from == OfferStatus.DRAFT) {
            checkComposition(offer.getItems().stream().map(OfferItem::getCatalogItemId).toList());
        }

        return project(applyTransition(offer, to, request.comment(), currentUserId()));
    }

    /**
     * Applique une transition deja autorisee : historique, version et evenements.
     *
     * Extrait de {@link #transition} pour que les transitions declenchees par le
     * planificateur empruntent exactement le meme chemin que celles declenchees par
     * un acteur. {@link OfferSchedulerService} ecrivait auparavant le statut
     * directement sur l'entite : une offre publiee automatiquement a son echeance
     * n'etait ni historisee, ni versionnee, n'emettait aucun evenement — donc
     * aucune notification au community manager, aucun indicateur cloturant son
     * Time To Market, et aucune diffusion vers les systemes tiers. Le meme circuit
     * produisait ainsi deux resultats differents selon qu'il etait acheve a la main
     * ou a l'echeance.
     *
     * @param actorId auteur a inscrire dans l'historique. Pour une transition
     *                automatique, c'est l'acteur qui l'avait decidee — celui qui a
     *                planifie la publication — et non un compte technique : le
     *                systeme execute une decision, il n'en prend pas.
     */
    private Offer applyTransition(Offer offer, OfferStatus to, String comment, UUID actorId) {
        OfferStatus from = offer.getStatus();

        OfferStatusHistory history = new OfferStatusHistory();
        history.setOffer(offer);
        history.setFromStatus(from);
        history.setToStatus(to);
        history.setChangedById(actorId);
        history.setComment(comment);
        offer.getStatusHistory().add(history);

        offer.setStatus(to);

        if (to == OfferStatus.PUBLISHED && offer.getPublishDate() == null) {
            offer.setPublishDate(LocalDateTime.now());
        }

        createVersion(offer, actorId);
        Offer saved = offerRepository.save(offer);

        eventPublisher.publishEvent(new OfferTransitionEvent(
                saved.getId(), saved.getName(), actorId, saved.getCreatedById(),
                from.name(), to.name(), saved.getAssignedToId()));

        // La publication ouvre la diffusion multicanale (cahier des charges 7.11).
        // L'evenement porte la fiche telle qu'elle est au moment ou elle est mise
        // en ligne : c'est cet etat-la qui doit partir vers les systemes tiers.
        if (to == OfferStatus.PUBLISHED) {
            eventPublisher.publishEvent(new OfferPublishedEvent(
                    saved.getId(), saved.getName(), actorId, serializeFiche(saved)));
        }
        return saved;
    }

    /**
     * Transition declenchee par le planificateur, sans acteur connecte.
     *
     * Les controles de permission n'ont pas de sens ici : il n'y a pas de principal.
     * Le controle de coherence, lui, reste applique — le planificateur ne doit pas
     * pouvoir produire une transition que le circuit interdit.
     */
    @Transactional
    public void applyScheduledTransition(Offer offer, OfferStatus to, String comment) {
        Set<OfferStatus> allowed = ALLOWED_TRANSITIONS.getOrDefault(offer.getStatus(), Set.of());
        if (!allowed.contains(to)) {
            throw new IllegalStateException(
                    "Transition automatique interdite : " + offer.getStatus() + " → " + to);
        }
        applyTransition(offer, to, comment, lastActorOf(offer));
    }

    /**
     * Auteur de la derniere decision prise sur cette fiche, a defaut son createur.
     *
     * changed_by_id est NOT NULL et refere users : une transition automatique doit
     * donc porter un auteur reel. Attribuer l'action a celui qui l'a decidee — le
     * chef de departement qui a planifie la publication — est plus fidele que
     * d'inventer un compte technique, et conserve la lisibilite de l'historique.
     */
    private UUID lastActorOf(Offer offer) {
        return offer.getStatusHistory().stream()
                .reduce((first, second) -> second)
                .map(OfferStatusHistory::getChangedById)
                .orElse(offer.getCreatedById());
    }

    /**
     * Etapes franchies par une offre, de la plus ancienne a la plus recente.
     *
     * La table etait alimentee depuis l'origine mais aucun endpoint ne la lisait :
     * la tracabilite existait en base sans etre accessible. Le perimetre de
     * lecture est celui de la fiche elle-meme — qui peut voir l'offre peut voir
     * son parcours — et les noms des acteurs suivent la meme regle de divulgation
     * que partout ailleurs.
     */
    @Transactional(readOnly = true)
    public List<OfferHistoryEntryResponse> history(UUID offerId) {
        Offer offer = findOffer(offerId);
        checkOwnership(offer);

        Map<UUID, String> names = maySeeAuthors()
                ? namesOf(offer.getStatusHistory().stream()
                        .map(OfferStatusHistory::getChangedById).toList())
                : Map.of();

        return offer.getStatusHistory().stream()
                .sorted(Comparator.comparing(OfferStatusHistory::getCreatedAt,
                        Comparator.nullsLast(Comparator.naturalOrder())))
                .map(entry -> OfferHistoryEntryResponse.from(entry, names))
                .toList();
    }

    /** Etats anterieurs complets de la fiche, du plus recent au plus ancien. */
    @Transactional(readOnly = true)
    public List<OfferVersionResponse> versions(UUID offerId) {
        Offer offer = findOffer(offerId);
        checkOwnership(offer);

        Map<UUID, String> names = maySeeAuthors()
                ? namesOf(offer.getVersions().stream().map(OfferVersion::getChangedById).toList())
                : Map.of();

        return offer.getVersions().stream()
                .sorted(Comparator.comparingLong(OfferVersion::getVersionNumber).reversed())
                .map(version -> OfferVersionResponse.from(version, names))
                .toList();
    }

    /**
     * Restaure le contenu d'une version anterieure.
     *
     * Le cahier des charges (7.7) reserve cette capacite a l'administrateur, seul
     * a disposer de l'historique complet. Elle n'existait pas : les versions
     * s'ecrivaient sans que rien ne puisse jamais les relire.
     *
     * Le statut n'est volontairement pas restaure. Une offre publiee que l'on
     * ramenerait a un etat « brouillon » aurait franchi le circuit a l'envers, sans
     * qu'aucun valideur ne se soit prononce : la restauration remet le *contenu*
     * d'une fiche, elle ne rejoue pas son parcours. Le score de qualite est
     * recalcule sur le contenu restaure, et la restauration produit elle-meme une
     * nouvelle version — elle est donc tracee comme n'importe quelle modification.
     */
    @Transactional
    public OfferResponse restoreVersion(UUID offerId, long versionNumber) {
        Offer offer = findOffer(offerId);

        OfferVersion version = offer.getVersions().stream()
                .filter(candidate -> candidate.getVersionNumber() == versionNumber)
                .findFirst()
                .orElseThrow(() -> new IllegalArgumentException(
                        "Version " + versionNumber + " introuvable pour cette offre"));

        Map<String, Object> snapshot = deserializeSnapshot(version.getSnapshot());
        if (snapshot.isEmpty()) {
            throw new IllegalStateException(
                    "La version " + versionNumber + " ne contient aucun contenu restaurable.");
        }

        offer.setName(text(snapshot, "name", offer.getName()));
        offer.setShortDescription(text(snapshot, "shortDescription", offer.getShortDescription()));
        offer.setLongDescription(text(snapshot, "longDescription", offer.getLongDescription()));
        offer.setSeoTitle(text(snapshot, "seoTitle", offer.getSeoTitle()));
        offer.setSeoDescription(text(snapshot, "seoDescription", offer.getSeoDescription()));
        offer.setLegalMentions(text(snapshot, "legalMentions", offer.getLegalMentions()));

        String price = text(snapshot, "promotionalPrice", null);
        if (price != null && !price.isBlank()) {
            try {
                offer.setPromotionalPrice(new java.math.BigDecimal(price));
            } catch (NumberFormatException ignored) {
                // Un instantane illisible sur ce champ ne doit pas faire echouer la
                // restauration des autres : le prix courant est conserve.
            }
        }

        offer.setQualityScore(computeQualityScore(offer));

        UUID actorId = currentUserId();
        OfferVersion trace = new OfferVersion();
        trace.setOffer(offer);
        trace.setVersionNumber(offer.getCurrentVersion());
        trace.setSnapshot(serializeSnapshot(offer));
        trace.setChangedById(actorId);
        trace.setChangeDescription("Restauration de la version " + versionNumber);
        offer.getVersions().add(trace);
        offer.setCurrentVersion(offer.getCurrentVersion() + 1);

        Offer saved = offerRepository.save(offer);
        return OfferResponse.from(saved, resolveActorNames(List.of(saved)),
                resolveCategoryPaths(List.of(saved)));
    }

    /** Identites d'un lot d'acteurs, en une requete. */
    private Map<UUID, String> namesOf(Collection<UUID> actorIds) {
        Set<UUID> ids = actorIds.stream().filter(java.util.Objects::nonNull)
                .collect(java.util.stream.Collectors.toSet());
        if (ids.isEmpty()) return Map.of();

        Map<UUID, String> names = new java.util.HashMap<>();
        for (User user : userRepository.findAllById(ids)) {
            names.put(user.getId(), (user.getFirstName() + " " + user.getLastName()).trim());
        }
        return names;
    }

    @SuppressWarnings("unchecked")
    private static Map<String, Object> deserializeSnapshot(String snapshot) {
        if (snapshot == null || snapshot.isBlank()) return Map.of();
        try {
            ObjectMapper mapper = new ObjectMapper();
            mapper.registerModule(new JavaTimeModule());
            return mapper.readValue(snapshot, Map.class);
        } catch (Exception e) {
            return Map.of();
        }
    }

    private static String text(Map<String, Object> snapshot, String key, String fallback) {
        Object value = snapshot.get(key);
        if (value == null) return fallback;
        String asText = String.valueOf(value);
        return asText.isBlank() ? fallback : asText;
    }

    @Transactional(readOnly = true)
    public OfferResponse getById(UUID id) {
        Offer offer = findOffer(id);
        checkOwnership(offer);
        return OfferResponse.from(offer, resolveActorNames(List.of(offer)),
                resolveCategoryPaths(List.of(offer)));
    }

    @Transactional(readOnly = true)
    public Page<OfferResponse> listByUser(UUID userId, Pageable pageable) {
        Page<Offer> page = offerRepository.findByCreatedById(userId, pageable);
        Map<UUID, String> names = resolveActorNames(page.getContent());
        Map<UUID, String> paths = resolveCategoryPaths(page.getContent());
        return page.map(offer -> OfferResponse.from(offer, names, paths));
    }

    /**
     * Statuts visibles par un role qui ne fait que diffuser.
     *
     * Une offre suspendue reste visible : le community manager doit pouvoir
     * constater qu'une offre qu'il a annoncee ne l'est plus, sinon elle disparait
     * de son ecran sans explication alors que ses campagnes, elles, subsistent.
     */
    private static final Set<OfferStatus> DIFFUSION_VISIBLE_STATUSES = Set.of(
            OfferStatus.PUBLISHED, OfferStatus.SUSPENDED);

    @Transactional(readOnly = true)
    public Page<OfferResponse> search(OfferStatus status, String search, Pageable pageable) {
        if (isDiffusionOnly()) {
            // Un statut explicitement demande est intersecte avec le perimetre
            // autorise : demander DRAFT ne doit pas ouvrir les brouillons.
            Set<OfferStatus> scope = status == null
                    ? DIFFUSION_VISIBLE_STATUSES
                    : DIFFUSION_VISIBLE_STATUSES.stream()
                            .filter(status::equals)
                            .collect(java.util.stream.Collectors.toSet());
            if (scope.isEmpty()) {
                return Page.empty(pageable);
            }
            return withNames(offerRepository.searchWithinStatuses(scope, search, pageable));
        }
        if (hasTransversalScope()) {
            return withNames(offerRepository.search(status, search, pageable));
        }
        return withNames(offerRepository.searchByOwner(status, search, currentUserId(), pageable));
    }

    /**
     * Effectif par statut des offres visibles par le compte connecte.
     *
     * Le comptage suit les trois memes regimes que {@link #search} — perimetre de
     * diffusion, vue transversale, ou seules ses propres fiches — pour qu'un
     * compteur ne revele jamais l'existence d'une offre que la liste refuserait
     * d'afficher.
     */
    @Transactional(readOnly = true)
    public OfferStatsResponse statsByStatus() {
        List<OfferRepository.StatusCount> counts;
        if (isDiffusionOnly()) {
            counts = offerRepository.countGroupedByStatusWithin(DIFFUSION_VISIBLE_STATUSES);
        } else if (hasTransversalScope()) {
            counts = offerRepository.countGroupedByStatus();
        } else {
            counts = offerRepository.countGroupedByStatusForOwner(currentUserId());
        }

        // Tous les statuts sont poses a zero d'abord : la base ne renvoie aucune
        // ligne pour un statut sans offre, et l'appelant recevrait une carte
        // incomplete dont il ne saurait pas distinguer « zero » de « absent ».
        Map<String, Long> byStatus = new LinkedHashMap<>();
        for (OfferStatus status : OfferStatus.values()) {
            byStatus.put(status.name(), 0L);
        }
        long total = 0;
        for (OfferRepository.StatusCount count : counts) {
            byStatus.put(count.getStatus().name(), count.getTotal());
            total += count.getTotal();
        }
        return new OfferStatsResponse(total, byStatus);
    }

    /** Resout les identites d'une page en une requete, puis projette. */
    private Page<OfferResponse> withNames(Page<Offer> page) {
        Map<UUID, String> names = resolveActorNames(page.getContent());
        Map<UUID, String> paths = resolveCategoryPaths(page.getContent());
        return page.map(offer -> OfferResponse.from(offer, names, paths));
    }

    /** Meme chose pour une liste non paginee. */
    private List<OfferResponse> withNames(List<Offer> offers) {
        Map<UUID, String> names = resolveActorNames(offers);
        Map<UUID, String> paths = resolveCategoryPaths(offers);
        return offers.stream().map(offer -> OfferResponse.from(offer, names, paths)).toList();
    }

    @Transactional(readOnly = true)
    public List<OfferResponse> listByStatus(OfferStatus status) {
        if (isDiffusionOnly()) {
            return DIFFUSION_VISIBLE_STATUSES.contains(status)
                    ? withNames(offerRepository.findByStatus(status))
                    : List.of();
        }
        if (hasTransversalScope()) {
            return withNames(offerRepository.findByStatus(status));
        }
        return withNames(offerRepository.findByStatusAndCreatedById(status, currentUserId()));
    }

    @Transactional
    public void delete(UUID offerId) {
        Offer offer = findOffer(offerId);
        checkOwnership(offer);
        offerRepository.delete(offer);
    }

    @Transactional(readOnly = true)
    public List<OfferResponse> listAll() {
        if (isDiffusionOnly()) {
            return withNames(offerRepository.findByStatusIn(DIFFUSION_VISIBLE_STATUSES));
        }
        if (hasTransversalScope()) {
            return withNames(offerRepository.findAll());
        }
        return withNames(offerRepository.findByCreatedById(currentUserId()));
    }

    private Offer findOffer(UUID id) {
        return offerRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Offre introuvable"));
    }

    private void createVersion(Offer offer, UUID actorId) {
        OfferVersion version = new OfferVersion();
        version.setOffer(offer);
        version.setVersionNumber(offer.getCurrentVersion());
        version.setSnapshot(serializeSnapshot(offer));
        version.setChangedById(actorId);
        version.setChangeDescription("Transition vers " + offer.getStatus());
        offer.getVersions().add(version);
        offer.setCurrentVersion(offer.getCurrentVersion() + 1);
    }

    private String serializeSnapshot(Offer offer) {
        try {
            ObjectMapper mapper = new ObjectMapper();
            mapper.registerModule(new JavaTimeModule());
            Map<String, Object> snapshot = Map.of(
                    "name", offer.getName(),
                    "status", offer.getStatus().name(),
                    "shortDescription", offer.getShortDescription() != null ? offer.getShortDescription() : "",
                    "longDescription", offer.getLongDescription() != null ? offer.getLongDescription() : "",
                    "seoTitle", offer.getSeoTitle() != null ? offer.getSeoTitle() : "",
                    "seoDescription", offer.getSeoDescription() != null ? offer.getSeoDescription() : "",
                    "promotionalPrice", offer.getPromotionalPrice() != null ? offer.getPromotionalPrice().toString() : "",
                    "legalMentions", offer.getLegalMentions() != null ? offer.getLegalMentions() : "",
                    "qualityScore", offer.getQualityScore()
            );
            return mapper.writeValueAsString(snapshot);
        } catch (Exception e) {
            return "{}";
        }
    }

    /**
     * Fiche complete destinee aux systemes tiers a la publication.
     *
     * Distincte de {@link #serializeSnapshot} : celle-ci sert au versionnement
     * interne et se limite aux champs dont la restauration a besoin, tandis que la
     * fiche diffusee doit contenir tout ce dont le CRM, le centre d'appel et le
     * site web ont besoin pour presenter l'offre — dates de validite, segment,
     * composition, mentions legales comprises.
     *
     * Le corps des exports valait jusqu'ici la chaine « {} » : la ligne existait,
     * mais elle ne transportait rien. Un export dont le contenu est vide n'est pas
     * une diffusion, c'est une trace de diffusion.
     */
    private String serializeFiche(Offer offer) {
        try {
            ObjectMapper mapper = new ObjectMapper();
            mapper.registerModule(new JavaTimeModule());

            Map<String, Object> fiche = new LinkedHashMap<>();
            fiche.put("offerId", offer.getId() != null ? offer.getId().toString() : null);
            fiche.put("name", offer.getName());
            fiche.put("status", offer.getStatus().name());
            fiche.put("shortDescription", offer.getShortDescription());
            fiche.put("longDescription", offer.getLongDescription());
            fiche.put("seoTitle", offer.getSeoTitle());
            fiche.put("seoDescription", offer.getSeoDescription());
            fiche.put("promotionalPrice",
                    offer.getPromotionalPrice() != null ? offer.getPromotionalPrice().toString() : null);
            fiche.put("currency", offer.getCurrency());
            fiche.put("validFrom", offer.getValidFrom() != null ? offer.getValidFrom().toString() : null);
            fiche.put("validUntil", offer.getValidUntil() != null ? offer.getValidUntil().toString() : null);
            fiche.put("targetSegment",
                    offer.getTargetSegment() != null ? offer.getTargetSegment().name() : null);
            fiche.put("customerType",
                    offer.getCustomerType() != null ? offer.getCustomerType().name() : null);
            fiche.put("legalMentions", offer.getLegalMentions());

            // Classification. C'est la raison d'etre du referentiel : le CRM, le
            // centre d'appel et le site web doivent ranger l'offre au meme endroit
            // que la plateforme, sans avoir a deviner depuis le libelle.
            Category category = offer.getCategoryId() != null
                    ? categoryRepository.findById(offer.getCategoryId()).orElse(null)
                    : null;
            fiche.put("type", ItemType.OFFER.name());
            fiche.put("categoryId", offer.getCategoryId() != null ? offer.getCategoryId().toString() : null);
            fiche.put("categoryPath", categoryPath(category));
            if (category != null) {
                boolean isSubCategory = category.getParent() != null;
                fiche.put("category", isSubCategory ? category.getParent().getName() : category.getName());
                fiche.put("subCategory", isSubCategory ? category.getName() : null);
            } else {
                fiche.put("category", null);
                fiche.put("subCategory", null);
            }

            fiche.put("qualityScore", offer.getQualityScore());
            fiche.put("publishDate", offer.getPublishDate() != null ? offer.getPublishDate().toString() : null);
            fiche.put("version", offer.getCurrentVersion());
            fiche.put("catalogItemIds", offer.getItems().stream()
                    .map(item -> item.getCatalogItemId().toString())
                    .toList());

            return mapper.writeValueAsString(fiche);
        } catch (Exception e) {
            // Un echec de serialisation doit se voir : renvoyer un corps vide
            // ferait passer une diffusion incomplete pour une diffusion reussie.
            throw new IllegalStateException(
                    "Impossible de serialiser la fiche de l'offre " + offer.getId(), e);
        }
    }

    /**
     * Permissions admises pour atteindre un statut donne.
     *
     * Le controleur exposait une seule annotation
     * hasAnyAuthority('OFFER_SUBMIT','OFFER_VALIDATE','OFFER_PUBLISH') sur un endpoint
     * de transition generique : detenir une seule des trois permissions les donnait
     * donc toutes. Verifie par appels reels, un chef de produit pouvait publier sa
     * propre offre sans validation, un chef de service publier a la place du chef de
     * departement et un chef de departement valider a la place du chef de service.
     * La separation des taches, qui est l'objet meme de la plateforme, n'existait pas.
     *
     * Le controle est fait ici parce que c'est le seul endroit ou le statut cible est
     * connu. L'annotation du controleur reste en place : elle ecarte d'emblee les
     * roles qui n'ont aucune part au cycle de vie.
     */
    private static Set<String> permissionsFor(OfferStatus from, OfferStatus to) {
        return switch (to) {
            // Retour a l'auteur : l'enrichisseur comme le soumetteur peuvent rendre la main.
            case DRAFT -> Set.of("OFFER_SUBMIT", "OFFER_ENRICH");
            // Depuis la validation, un passage en enrichissement est un rejet : il
            // appartient au valideur. Depuis le brouillon, c'est une soumission.
            case IN_ENRICHMENT -> from == OfferStatus.IN_VALIDATION
                    ? Set.of("OFFER_VALIDATE")
                    : Set.of("OFFER_SUBMIT");
            case IN_VALIDATION -> Set.of("OFFER_SUBMIT");
            case VALIDATED -> Set.of("OFFER_VALIDATE");
            // Planification, publication, suspension, retrait et archivage relevent
            // tous de la decision de mise sur le marche.
            default -> Set.of("OFFER_PUBLISH");
        };
    }

    private void checkTransitionPermission(OfferStatus from, OfferStatus to) {
        Set<String> required = permissionsFor(from, to);
        CustomUserDetails principal = (CustomUserDetails) SecurityContextHolder
                .getContext().getAuthentication().getPrincipal();
        boolean granted = principal.getAuthorities().stream()
                .anyMatch(a -> required.contains(a.getAuthority()));
        if (!granted) {
            throw new AccessDeniedException(
                    "Passer une offre en " + to + " exige la permission "
                            + String.join(" ou ", required.stream().sorted().toList()));
        }
    }

    private void checkOwnership(Offer offer) {
        // Un role de diffusion a une vue transversale, mais bornee aux offres
        // publiques : sans ce controle, il lui suffisait d'appeler /offers/{id}
        // avec un identifiant pour lire le brouillon d'un chef de produit.
        if (isDiffusionOnly()) {
            if (!DIFFUSION_VISIBLE_STATUSES.contains(offer.getStatus())) {
                throw new AccessDeniedException(
                        "Accès interdit : cette offre n'est pas publiée");
            }
            return;
        }
        if (!hasTransversalScope() && !offer.getCreatedById().equals(currentUserId())) {
            throw new AccessDeniedException("Accès interdit : cette offre ne vous appartient pas");
        }
    }

    /**
     * Perimetre de visibilite et d'intervention sur une fiche.
     *
     * Le cahier des charges (regles/PROMPT_MAITRE..., regles de visibilite) impose
     * deux regimes distincts :
     *   « un chef de produit ne voit que les offres qu'il a lui-meme creees,
     *     jamais celles des autres chefs de produit »
     *   « le chef de service a une vue transversale sur plusieurs chefs de produit
     *     et voit qui a cree quelle offre/produit »
     *
     * Le code ne connaissait que le couple administrateur / proprietaire : tout role
     * non administrateur etait ramene a ses propres fiches. Le chef de service ne
     * pouvait donc voir aucune offre a valider, l'analyste marketing aucune offre a
     * enrichir et le chef de departement aucune offre a publier, alors qu'ils
     * detiennent OFFER_VALIDATE, OFFER_ENRICH et OFFER_PUBLISH. Le circuit de
     * validation etait inapplicable des que l'auteur n'etait pas l'acteur suivant.
     *
     * Les permissions restent verifiees en amont par les annotations @PreAuthorize
     * des controleurs : ce perimetre ne fait que decider si l'acteur est limite a ses
     * propres fiches, il n'accorde aucune capacite supplementaire.
     */
    private boolean hasTransversalScope() {
        CustomUserDetails principal = (CustomUserDetails) SecurityContextHolder
                .getContext().getAuthentication().getPrincipal();
        return principal.getUser().getRole().getName().hasTransversalScope();
    }

    /**
     * Role sans aucune part au cycle de vie : il diffuse ce qui est deja en ligne.
     *
     * Determine par les permissions et non par le nom du role, pour rester en
     * miroir de la matrice : un compte qui ne peut ni creer, ni soumettre, ni
     * enrichir, ni valider, ni publier n'a aucune raison de voir une fiche qui
     * n'est pas encore publique. C'est aujourd'hui le community manager.
     */
    /**
     * Le demandeur a-t-il a connaitre l'auteur des fiches qu'il consulte ?
     *
     * Deux regles du cahier des charges se combinent ici : le chef de service
     * « voit qui a cree quelle offre » (l. 114), et « les chefs de produit entre eux
     * ne voient jamais qui a cree quel produit » (l. 115). Le chef de produit est
     * donc exclu — il ne voit de toute facon que ses propres fiches — et le
     * community manager aussi : il diffuse des offres publiees, l'organisation
     * interne qui les a produites ne le regarde pas.
     */
    private boolean maySeeAuthors() {
        return hasTransversalScope() && !isDiffusionOnly();
    }

    /**
     * Resout en une seule requete les identites citees par un lot de fiches.
     *
     * Renvoie une table vide lorsque le demandeur n'a pas a connaitre les auteurs :
     * le filtrage se fait ici, a la source, plutot que dans le DTO ou dans l'ecran.
     * Une identite absente de la table laisse le champ nul cote client.
     */
    private Map<UUID, String> resolveActorNames(Collection<Offer> offers) {
        if (!maySeeAuthors()) return Map.of();

        Set<UUID> ids = new java.util.HashSet<>();
        for (Offer offer : offers) {
            if (offer.getCreatedById() != null) ids.add(offer.getCreatedById());
            if (offer.getAssignedToId() != null) ids.add(offer.getAssignedToId());
        }
        if (ids.isEmpty()) return Map.of();

        Map<UUID, String> names = new java.util.HashMap<>();
        for (User user : userRepository.findAllById(ids)) {
            names.put(user.getId(), (user.getFirstName() + " " + user.getLastName()).trim());
        }
        return names;
    }

    private boolean isDiffusionOnly() {
        CustomUserDetails principal = (CustomUserDetails) SecurityContextHolder
                .getContext().getAuthentication().getPrincipal();
        Set<String> granted = principal.getAuthorities().stream()
                .map(authority -> authority.getAuthority())
                .collect(java.util.stream.Collectors.toSet());

        // La condition est positive — detenir la permission de diffusion — et non
        // seulement l'absence des permissions de cycle de vie. Une definition par
        // la seule absence rangeait parmi les diffuseurs tout compte dont les
        // permissions n'etaient pas chargees, et lui refusait alors des fiches
        // qu'il avait le droit de lire.
        Set<String> lifecyclePermissions = Set.of(
                "OFFER_CREATE", "OFFER_SUBMIT", "OFFER_ENRICH", "OFFER_VALIDATE", "OFFER_PUBLISH");
        return granted.contains("CAMPAIGN_MANAGE")
                && lifecyclePermissions.stream().noneMatch(granted::contains);
    }

    private UUID currentUserId() {
        CustomUserDetails principal = (CustomUserDetails) SecurityContextHolder
                .getContext().getAuthentication().getPrincipal();
        return principal.getUserId();
    }
}
