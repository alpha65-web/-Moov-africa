package com.moov.pim.lifecycle.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.datatype.jsr310.JavaTimeModule;
import com.moov.pim.lifecycle.api.dto.CreateOfferRequest;
import com.moov.pim.lifecycle.api.dto.EnrichOfferRequest;
import com.moov.pim.lifecycle.api.dto.OfferResponse;
import com.moov.pim.lifecycle.api.dto.StatusTransitionRequest;
import com.moov.pim.lifecycle.domain.Offer;
import com.moov.pim.lifecycle.domain.OfferItem;
import com.moov.pim.lifecycle.domain.OfferStatus;
import com.moov.pim.lifecycle.domain.OfferStatusHistory;
import com.moov.pim.lifecycle.domain.OfferVersion;
import com.moov.pim.lifecycle.repository.OfferRepository;
import com.moov.pim.permissions.security.CustomUserDetails;
import com.moov.pim.shared.event.OfferCreatedEvent;
import com.moov.pim.shared.event.OfferTransitionEvent;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
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

    public OfferService(OfferRepository offerRepository, ApplicationEventPublisher eventPublisher) {
        this.offerRepository = offerRepository;
        this.eventPublisher = eventPublisher;
    }

    @Transactional
    public OfferResponse create(CreateOfferRequest request) {
        Offer offer = new Offer();
        offer.setName(request.name());
        offer.setShortDescription(request.shortDescription());
        offer.setLongDescription(request.longDescription());
        offer.setPromotionalPrice(request.promotionalPrice());
        offer.setValidFrom(request.validFrom());
        offer.setValidUntil(request.validUntil());
        offer.setTargetSegment(request.targetSegment());
        offer.setCustomerType(request.customerType());
        offer.setLegalMentions(request.legalMentions());
        offer.setCreatedById(currentUserId());

        if (request.catalogItemIds() != null) {
            for (UUID catalogItemId : request.catalogItemIds()) {
                offer.addItem(new OfferItem(catalogItemId));
            }
        }

        offer = offerRepository.save(offer);
        eventPublisher.publishEvent(new OfferCreatedEvent(offer.getId(), offer.getName(), currentUserId()));
        return OfferResponse.from(offer);
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
        offer = offerRepository.save(offer);
        return OfferResponse.from(offer);
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

        OfferStatusHistory history = new OfferStatusHistory();
        history.setOffer(offer);
        history.setFromStatus(from);
        history.setToStatus(to);
        history.setChangedById(currentUserId());
        history.setComment(request.comment());
        offer.getStatusHistory().add(history);

        offer.setStatus(to);

        if (to == OfferStatus.PUBLISHED && offer.getPublishDate() == null) {
            offer.setPublishDate(LocalDateTime.now());
        }

        createVersion(offer);
        offer = offerRepository.save(offer);
        eventPublisher.publishEvent(new OfferTransitionEvent(
                offer.getId(), offer.getName(), currentUserId(), offer.getCreatedById(),
                from.name(), to.name()));
        return OfferResponse.from(offer);
    }

    @Transactional(readOnly = true)
    public OfferResponse getById(UUID id) {
        Offer offer = findOffer(id);
        checkOwnership(offer);
        return OfferResponse.from(offer);
    }

    @Transactional(readOnly = true)
    public Page<OfferResponse> listByUser(UUID userId, Pageable pageable) {
        return offerRepository.findByCreatedById(userId, pageable).map(OfferResponse::from);
    }

    @Transactional(readOnly = true)
    public Page<OfferResponse> search(OfferStatus status, String search, Pageable pageable) {
        if (hasTransversalScope()) {
            return offerRepository.search(status, search, pageable).map(OfferResponse::from);
        }
        return offerRepository.searchByOwner(status, search, currentUserId(), pageable).map(OfferResponse::from);
    }

    @Transactional(readOnly = true)
    public List<OfferResponse> listByStatus(OfferStatus status) {
        if (hasTransversalScope()) {
            return offerRepository.findByStatus(status).stream()
                    .map(OfferResponse::from)
                    .toList();
        }
        return offerRepository.findByStatusAndCreatedById(status, currentUserId()).stream()
                .map(OfferResponse::from)
                .toList();
    }

    @Transactional
    public void delete(UUID offerId) {
        Offer offer = findOffer(offerId);
        checkOwnership(offer);
        offerRepository.delete(offer);
    }

    @Transactional(readOnly = true)
    public List<OfferResponse> listAll() {
        if (hasTransversalScope()) {
            return offerRepository.findAll().stream()
                    .map(OfferResponse::from)
                    .toList();
        }
        return offerRepository.findByCreatedById(currentUserId()).stream()
                .map(OfferResponse::from)
                .toList();
    }

    private Offer findOffer(UUID id) {
        return offerRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Offre introuvable"));
    }

    private void createVersion(Offer offer) {
        OfferVersion version = new OfferVersion();
        version.setOffer(offer);
        version.setVersionNumber(offer.getCurrentVersion());
        version.setSnapshot(serializeSnapshot(offer));
        version.setChangedById(currentUserId());
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

    private UUID currentUserId() {
        CustomUserDetails principal = (CustomUserDetails) SecurityContextHolder
                .getContext().getAuthentication().getPrincipal();
        return principal.getUserId();
    }
}
