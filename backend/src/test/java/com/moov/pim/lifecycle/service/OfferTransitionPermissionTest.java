package com.moov.pim.lifecycle.service;

import com.moov.pim.lifecycle.domain.Offer;
import com.moov.pim.lifecycle.domain.OfferStatus;
import com.moov.pim.lifecycle.api.dto.StatusTransitionRequest;
import com.moov.pim.lifecycle.repository.OfferRepository;
import com.moov.pim.permissions.domain.Permission;
import com.moov.pim.permissions.domain.Role;
import com.moov.pim.permissions.domain.RoleName;
import com.moov.pim.permissions.domain.User;
import com.moov.pim.permissions.security.CustomUserDetails;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;

import java.lang.reflect.Field;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.when;

/**
 * Séparation des tâches sur le cycle de vie d'une offre.
 *
 * Le contrôleur portait une annotation unique
 * {@code hasAnyAuthority('OFFER_SUBMIT','OFFER_VALIDATE','OFFER_PUBLISH')} sur un
 * endpoint de transition générique : détenir une seule des trois permissions les
 * donnait toutes. Constaté par appels réels sur la base de démonstration — un chef de
 * produit publiait sa propre offre sans validation, un chef de service publiait à la
 * place du chef de département, un chef de département validait à la place du chef de
 * service. La gouvernance que la plateforme est censée porter n'existait pas.
 */
@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class OfferTransitionPermissionTest {

    @Mock private OfferRepository offerRepository;
    @Mock private ApplicationEventPublisher eventPublisher;
    @InjectMocks private OfferService offerService;

    private static final String SUBMIT = "OFFER_SUBMIT";
    private static final String ENRICH = "OFFER_ENRICH";
    private static final String VALIDATE = "OFFER_VALIDATE";
    private static final String PUBLISH = "OFFER_PUBLISH";

    private UUID authenticate(String... permissions) throws Exception {
        var constructor = Role.class.getDeclaredConstructor();
        constructor.setAccessible(true);
        Role role = constructor.newInstance();

        Field nameField = Role.class.getDeclaredField("name");
        nameField.setAccessible(true);
        nameField.set(role, RoleName.CHEF_PRODUIT);

        Field permsField = Role.class.getDeclaredField("permissions");
        permsField.setAccessible(true);
        Set<Permission> perms = new java.util.HashSet<>();
        for (String code : permissions) {
            perms.add(new Permission(code, code));
        }
        permsField.set(role, perms);

        User user = new User("acteur@moov.bf", "$2a$hash", "Acteur", "Test", role);
        UUID userId = UUID.randomUUID();
        Field idField = User.class.getDeclaredField("id");
        idField.setAccessible(true);
        idField.set(user, userId);

        CustomUserDetails details = new CustomUserDetails(user);
        SecurityContextHolder.getContext().setAuthentication(
                new UsernamePasswordAuthenticationToken(details, null, details.getAuthorities()));
        return userId;
    }

    private void offerInStatus(UUID offerId, OfferStatus status, UUID ownerId) {
        Offer offer = new Offer();
        offer.setStatus(status);
        offer.setCreatedById(ownerId);
        when(offerRepository.findById(offerId)).thenReturn(Optional.of(offer));
        when(offerRepository.save(any(Offer.class))).thenAnswer(i -> i.getArgument(0));
    }

    private void attempt(OfferStatus from, OfferStatus to, UUID owner) {
        UUID offerId = UUID.randomUUID();
        offerInStatus(offerId, from, owner);
        offerService.transition(offerId, new StatusTransitionRequest(to, "commentaire"));
    }

    // ---- Publication : réservée aux porteurs d'OFFER_PUBLISH -----------------

    @Test
    void publier_estRefuseAuSeulPorteurDeOfferSubmit() throws Exception {
        UUID me = authenticate(SUBMIT);
        AccessDeniedException ex = assertThrows(AccessDeniedException.class,
                () -> attempt(OfferStatus.VALIDATED, OfferStatus.PUBLISHED, me));
        assertTrue(ex.getMessage().contains("OFFER_PUBLISH"), ex.getMessage());
    }

    @Test
    void publier_estRefuseAuSeulPorteurDeOfferValidate() throws Exception {
        UUID me = authenticate(VALIDATE);
        assertThrows(AccessDeniedException.class,
                () -> attempt(OfferStatus.VALIDATED, OfferStatus.PUBLISHED, me));
    }

    @Test
    void publier_estAutoriseAuPorteurDeOfferPublish() throws Exception {
        UUID me = authenticate(PUBLISH);
        assertDoesNotThrow(() -> attempt(OfferStatus.VALIDATED, OfferStatus.PUBLISHED, me));
    }

    // ---- Validation : réservée aux porteurs d'OFFER_VALIDATE ----------------

    @Test
    void valider_estRefuseAuSeulPorteurDeOfferSubmit() throws Exception {
        UUID me = authenticate(SUBMIT);
        AccessDeniedException ex = assertThrows(AccessDeniedException.class,
                () -> attempt(OfferStatus.IN_VALIDATION, OfferStatus.VALIDATED, me));
        assertTrue(ex.getMessage().contains("OFFER_VALIDATE"), ex.getMessage());
    }

    @Test
    void valider_estRefuseAuSeulPorteurDeOfferPublish() throws Exception {
        UUID me = authenticate(PUBLISH);
        assertThrows(AccessDeniedException.class,
                () -> attempt(OfferStatus.IN_VALIDATION, OfferStatus.VALIDATED, me));
    }

    @Test
    void valider_estAutoriseAuPorteurDeOfferValidate() throws Exception {
        UUID me = authenticate(VALIDATE);
        assertDoesNotThrow(() -> attempt(OfferStatus.IN_VALIDATION, OfferStatus.VALIDATED, me));
    }

    // ---- Soumission et rejet ------------------------------------------------

    @Test
    void soumettreAValidation_estAutoriseAuPorteurDeOfferSubmit() throws Exception {
        UUID me = authenticate(SUBMIT);
        assertDoesNotThrow(() -> attempt(OfferStatus.IN_ENRICHMENT, OfferStatus.IN_VALIDATION, me));
    }

    @Test
    void soumettreAValidation_estRefuseAuSeulEnrichisseur() throws Exception {
        UUID me = authenticate(ENRICH);
        assertThrows(AccessDeniedException.class,
                () -> attempt(OfferStatus.IN_ENRICHMENT, OfferStatus.IN_VALIDATION, me));
    }

    /**
     * Renvoyer une offre en enrichissement depuis la validation est un rejet : c'est
     * une décision du valideur, pas une nouvelle soumission.
     */
    @Test
    void rejeterVersEnrichissement_appartientAuValideur() throws Exception {
        UUID valideur = authenticate(VALIDATE);
        assertDoesNotThrow(() -> attempt(OfferStatus.IN_VALIDATION, OfferStatus.IN_ENRICHMENT, valideur));

        UUID soumetteur = authenticate(SUBMIT);
        assertThrows(AccessDeniedException.class,
                () -> attempt(OfferStatus.IN_VALIDATION, OfferStatus.IN_ENRICHMENT, soumetteur));
    }

    /** L'administrateur détient toutes les permissions : aucune étape ne lui est fermée. */
    @Test
    void administrateur_peutFranchirToutesLesEtapes() throws Exception {
        UUID me = authenticate(SUBMIT, ENRICH, VALIDATE, PUBLISH);
        assertDoesNotThrow(() -> attempt(OfferStatus.IN_ENRICHMENT, OfferStatus.IN_VALIDATION, me));
        assertDoesNotThrow(() -> attempt(OfferStatus.IN_VALIDATION, OfferStatus.VALIDATED, me));
        assertDoesNotThrow(() -> attempt(OfferStatus.VALIDATED, OfferStatus.PUBLISHED, me));
    }

    @AfterEach
    void tearDown() {
        SecurityContextHolder.clearContext();
    }
}
