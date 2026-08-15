package com.moov.pim.lifecycle.service;

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

        for (UUID catalogItemId : request.catalogItemIds()) {
            offer.addItem(new OfferItem(catalogItemId));
        }

        offer = offerRepository.save(offer);
        eventPublisher.publishEvent(new OfferCreatedEvent(offer.getId(), offer.getName(), currentUserId()));
        return OfferResponse.from(offer);
    }

    @Transactional
    public OfferResponse enrich(UUID offerId, EnrichOfferRequest request) {
        Offer offer = findOffer(offerId);

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
        OfferStatus from = offer.getStatus();
        OfferStatus to = request.targetStatus();

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
        offer.getStatusHistory().add(history);

        offer.setStatus(to);

        if (to == OfferStatus.PUBLISHED && offer.getPublishDate() == null) {
            offer.setPublishDate(LocalDateTime.now());
        }

        createVersion(offer);
        offer = offerRepository.save(offer);
        eventPublisher.publishEvent(new OfferTransitionEvent(
                offer.getId(), offer.getName(), currentUserId(), from.name(), to.name()));
        return OfferResponse.from(offer);
    }

    @Transactional(readOnly = true)
    public OfferResponse getById(UUID id) {
        return OfferResponse.from(findOffer(id));
    }

    @Transactional(readOnly = true)
    public List<OfferResponse> listByUser(UUID userId) {
        return offerRepository.findByCreatedById(userId).stream()
                .map(OfferResponse::from)
                .toList();
    }

    @Transactional(readOnly = true)
    public List<OfferResponse> listByStatus(OfferStatus status) {
        return offerRepository.findByStatus(status).stream()
                .map(OfferResponse::from)
                .toList();
    }

    @Transactional(readOnly = true)
    public List<OfferResponse> listAll() {
        return offerRepository.findAll().stream()
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
        version.setSnapshot("{}");
        version.setChangedById(currentUserId());
        version.setChangeDescription("Transition vers " + offer.getStatus());
        offer.getVersions().add(version);
        offer.setCurrentVersion(offer.getCurrentVersion() + 1);
    }

    private UUID currentUserId() {
        CustomUserDetails principal = (CustomUserDetails) SecurityContextHolder
                .getContext().getAuthentication().getPrincipal();
        return principal.getUserId();
    }
}
