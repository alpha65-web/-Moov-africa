package com.moov.pim.lifecycle.service;

import com.moov.pim.lifecycle.api.dto.CreateOfferRequest;
import com.moov.pim.lifecycle.api.dto.EnrichOfferRequest;
import com.moov.pim.lifecycle.api.dto.OfferResponse;
import com.moov.pim.lifecycle.api.dto.StatusTransitionRequest;
import com.moov.pim.lifecycle.domain.CustomerType;
import com.moov.pim.lifecycle.domain.Offer;
import com.moov.pim.lifecycle.domain.OfferStatus;
import com.moov.pim.lifecycle.domain.TargetSegment;
import com.moov.pim.lifecycle.repository.OfferRepository;
import com.moov.pim.permissions.domain.Permission;
import com.moov.pim.permissions.domain.Role;
import com.moov.pim.permissions.domain.RoleName;
import com.moov.pim.permissions.domain.User;
import com.moov.pim.permissions.security.CustomUserDetails;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;

import java.lang.reflect.Field;
import java.math.BigDecimal;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class OfferServiceTest {

    @Mock private OfferRepository offerRepository;
    @InjectMocks private OfferService offerService;

    private UUID userId;

    @BeforeEach
    void setUp() throws Exception {
        userId = UUID.randomUUID();
        var constructor = Role.class.getDeclaredConstructor();
        constructor.setAccessible(true);
        Role role = constructor.newInstance();
        Field nameField = Role.class.getDeclaredField("name");
        nameField.setAccessible(true);
        nameField.set(role, RoleName.CHEF_PRODUIT);

        User user = new User("chef@moov.bf", "$2a$hash", "Chef", "Produit", role);
        Field idField = User.class.getDeclaredField("id");
        idField.setAccessible(true);
        idField.set(user, userId);

        CustomUserDetails details = new CustomUserDetails(user);
        SecurityContextHolder.getContext().setAuthentication(
                new UsernamePasswordAuthenticationToken(details, null, details.getAuthorities()));
    }

    @AfterEach
    void tearDown() {
        SecurityContextHolder.clearContext();
    }

    @Test
    void create_shouldReturnOfferInDraftStatus() {
        CreateOfferRequest request = new CreateOfferRequest(
                "Offre Internet 5G", "Internet rapide", "Description longue",
                new BigDecimal("9990"), null, null,
                TargetSegment.PREPAID, CustomerType.INDIVIDUAL,
                "Mentions légales", List.of(UUID.randomUUID()));

        when(offerRepository.save(any(Offer.class))).thenAnswer(inv -> {
            Offer o = inv.getArgument(0);
            setId(o, UUID.randomUUID());
            return o;
        });

        OfferResponse response = offerService.create(request);

        assertNotNull(response);
        assertEquals("Offre Internet 5G", response.name());
        assertEquals("DRAFT", response.status());
        assertEquals(userId, response.createdById());
    }

    @Test
    void transition_draftToInEnrichment_shouldSucceed() {
        Offer offer = buildOffer(OfferStatus.DRAFT);
        StatusTransitionRequest request = new StatusTransitionRequest(OfferStatus.IN_ENRICHMENT, null);

        when(offerRepository.findById(offer.getId())).thenReturn(Optional.of(offer));
        when(offerRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));

        OfferResponse response = offerService.transition(offer.getId(), request);

        assertEquals("IN_ENRICHMENT", response.status());
    }

    @Test
    void transition_draftToPublished_shouldThrow() {
        Offer offer = buildOffer(OfferStatus.DRAFT);
        StatusTransitionRequest request = new StatusTransitionRequest(OfferStatus.PUBLISHED, null);

        when(offerRepository.findById(offer.getId())).thenReturn(Optional.of(offer));

        IllegalStateException ex = assertThrows(IllegalStateException.class,
                () -> offerService.transition(offer.getId(), request));
        assertTrue(ex.getMessage().contains("Transition interdite"));
    }

    @ParameterizedTest
    @CsvSource({
            "DRAFT, IN_ENRICHMENT",
            "IN_ENRICHMENT, IN_VALIDATION",
            "IN_ENRICHMENT, DRAFT",
            "IN_VALIDATION, VALIDATED",
            "VALIDATED, PLANNED",
            "VALIDATED, PUBLISHED",
            "PLANNED, PUBLISHED",
            "PUBLISHED, SUSPENDED",
            "PUBLISHED, OBSOLETE",
            "PUBLISHED, WITHDRAWN",
            "SUSPENDED, PUBLISHED",
            "SUSPENDED, WITHDRAWN",
            "OBSOLETE, ARCHIVED",
            "WITHDRAWN, ARCHIVED"
    })
    void transition_allowedTransitions_shouldSucceed(String from, String to) {
        OfferStatus fromStatus = OfferStatus.valueOf(from);
        OfferStatus toStatus = OfferStatus.valueOf(to);

        Offer offer = buildOffer(fromStatus);
        String comment = (fromStatus == OfferStatus.IN_VALIDATION
                && (toStatus == OfferStatus.IN_ENRICHMENT))
                ? "Rejet : contenu incomplet" : null;

        StatusTransitionRequest request = new StatusTransitionRequest(toStatus, comment);

        when(offerRepository.findById(offer.getId())).thenReturn(Optional.of(offer));
        when(offerRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));

        OfferResponse response = offerService.transition(offer.getId(), request);
        assertEquals(to, response.status());
    }

    @ParameterizedTest
    @CsvSource({
            "DRAFT, PUBLISHED",
            "DRAFT, VALIDATED",
            "IN_ENRICHMENT, PUBLISHED",
            "IN_VALIDATION, DRAFT",
            "PUBLISHED, DRAFT",
            "ARCHIVED, DRAFT"
    })
    void transition_forbiddenTransitions_shouldThrow(String from, String to) {
        Offer offer = buildOffer(OfferStatus.valueOf(from));
        StatusTransitionRequest request = new StatusTransitionRequest(OfferStatus.valueOf(to), null);

        when(offerRepository.findById(offer.getId())).thenReturn(Optional.of(offer));

        assertThrows(IllegalStateException.class,
                () -> offerService.transition(offer.getId(), request));
    }

    @Test
    void transition_rejectionWithoutComment_shouldThrow() {
        Offer offer = buildOffer(OfferStatus.IN_VALIDATION);
        StatusTransitionRequest request = new StatusTransitionRequest(OfferStatus.IN_ENRICHMENT, null);

        when(offerRepository.findById(offer.getId())).thenReturn(Optional.of(offer));

        assertThrows(IllegalArgumentException.class,
                () -> offerService.transition(offer.getId(), request));
    }

    @Test
    void transition_toPublished_shouldSetPublishDate() {
        Offer offer = buildOffer(OfferStatus.VALIDATED);
        StatusTransitionRequest request = new StatusTransitionRequest(OfferStatus.PUBLISHED, null);

        when(offerRepository.findById(offer.getId())).thenReturn(Optional.of(offer));
        when(offerRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));

        offerService.transition(offer.getId(), request);

        assertNotNull(offer.getPublishDate());
    }

    @Test
    void enrich_shouldUpdateFields() {
        Offer offer = buildOffer(OfferStatus.DRAFT);
        EnrichOfferRequest request = new EnrichOfferRequest(
                "Nouvelle description courte", "Nouvelle description longue",
                "SEO Titre", "SEO Description", "Mentions mises à jour");

        when(offerRepository.findById(offer.getId())).thenReturn(Optional.of(offer));
        when(offerRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));

        OfferResponse response = offerService.enrich(offer.getId(), request);

        assertEquals("Nouvelle description courte", response.shortDescription());
        assertEquals("SEO Titre", response.seoTitle());
    }

    @Test
    void enrich_shouldThrowIfOfferIsPublished() {
        Offer offer = buildOffer(OfferStatus.PUBLISHED);
        EnrichOfferRequest request = new EnrichOfferRequest(
                "Desc", null, null, null, null);

        when(offerRepository.findById(offer.getId())).thenReturn(Optional.of(offer));

        assertThrows(IllegalStateException.class,
                () -> offerService.enrich(offer.getId(), request));
    }

    @Test
    void getById_shouldThrowIfNotFound() {
        UUID fakeId = UUID.randomUUID();
        when(offerRepository.findById(fakeId)).thenReturn(Optional.empty());

        assertThrows(IllegalArgumentException.class,
                () -> offerService.getById(fakeId));
    }

    private Offer buildOffer(OfferStatus status) {
        Offer offer = new Offer();
        offer.setName("Test Offer");
        offer.setStatus(status);
        offer.setCreatedById(userId);
        setId(offer, UUID.randomUUID());
        return offer;
    }

    private void setId(Object entity, UUID id) {
        try {
            Field idField = entity.getClass().getDeclaredField("id");
            idField.setAccessible(true);
            idField.set(entity, id);
        } catch (Exception e) {
            throw new RuntimeException(e);
        }
    }
}
