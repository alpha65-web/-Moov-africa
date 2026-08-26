package com.moov.pim.lifecycle.service;

import com.moov.pim.lifecycle.api.dto.AssignOfferRequest;
import com.moov.pim.lifecycle.api.dto.CreateOfferRequest;
import com.moov.pim.lifecycle.api.dto.EnrichOfferRequest;
import com.moov.pim.lifecycle.api.dto.OfferResponse;
import com.moov.pim.lifecycle.api.dto.StatusTransitionRequest;
import com.moov.pim.lifecycle.api.dto.UpdateOfferRequest;
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
import org.springframework.context.ApplicationEventPublisher;
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
    @Mock private com.moov.pim.catalog.repository.CategoryRepository categoryRepository;
    @Mock private ApplicationEventPublisher eventPublisher;
    @Mock private com.moov.pim.permissions.repository.UserRepository userRepository;
    // Le moteur de regles est desormais interroge a la creation, a la modification
    // de la composition et a la soumission. Une doublure sans stub renvoie une
    // liste vide : aucune violation, ce qui laisse ces tests porter sur ce qu ils
    // verifient reellement — les transitions et les permissions.
    @Mock private com.moov.pim.rules.service.RuleEvaluationService ruleEvaluationService;
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

        // Cette classe verifie la machine a etats, pas la matrice des permissions :
        // le role recoit donc toutes les permissions du cycle de vie. La separation
        // des taches, elle, est couverte par OfferTransitionPermissionTest.
        Field permsField = Role.class.getDeclaredField("permissions");
        permsField.setAccessible(true);
        permsField.set(role, new java.util.HashSet<>(java.util.List.of(
                new com.moov.pim.permissions.domain.Permission("OFFER_SUBMIT", ""),
                new com.moov.pim.permissions.domain.Permission("OFFER_ENRICH", ""),
                new com.moov.pim.permissions.domain.Permission("OFFER_VALIDATE", ""),
                new com.moov.pim.permissions.domain.Permission("OFFER_PUBLISH", ""))));

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

    // ===================================================================
    // Score de completude de la fiche
    //
    // Le champ existait sur l'entite et l'interface en affichait une barre de
    // progression sur chaque ligne d'offre, mais aucun code ne l'avait jamais
    // calcule : il valait zero pour toutes les offres. Un indicateur qui affiche
    // la meme valeur pour tout le monde n'informe de rien.
    // ===================================================================


    /**
     * Categorie d'offres valide, telle que la resoudra le service.
     *
     * Depuis la classification, la creation d'une offre exige une categorie de
     * type OFFER et la verifie avant enregistrement.
     */
    private UUID offerCategory() {
        UUID id = UUID.randomUUID();
        var category = new com.moov.pim.catalog.domain.Category(
                "Forfaits Data", null, null, 0, com.moov.pim.catalog.domain.ItemType.OFFER);
        try {
            var field = com.moov.pim.catalog.domain.Category.class.getDeclaredField("id");
            field.setAccessible(true);
            field.set(category, id);
        } catch (Exception e) {
            throw new RuntimeException(e);
        }
        when(categoryRepository.findById(id)).thenReturn(java.util.Optional.of(category));
        return id;
    }


    @Test
    void create_shouldRefuseCategoryThatDoesNotClassifyOffers() {
        UUID categoryId = UUID.randomUUID();
        var category = new com.moov.pim.catalog.domain.Category(
                "Routeurs", null, null, 1, com.moov.pim.catalog.domain.ItemType.PRODUCT);
        try {
            var field = com.moov.pim.catalog.domain.Category.class.getDeclaredField("id");
            field.setAccessible(true);
            field.set(category, categoryId);
        } catch (Exception e) {
            throw new RuntimeException(e);
        }
        when(categoryRepository.findById(categoryId)).thenReturn(java.util.Optional.of(category));

        CreateOfferRequest request = new CreateOfferRequest(
                "Smart 1 Go", categoryId, null, null, null, null, null, null, null, null, null, null);

        IllegalArgumentException ex = assertThrows(IllegalArgumentException.class,
                () -> offerService.create(request));

        assertTrue(ex.getMessage().contains("Produit"));
        org.mockito.Mockito.verify(offerRepository, org.mockito.Mockito.never()).save(any(Offer.class));
    }

    @Test
    void create_shouldRefuseUnknownCategory() {
        UUID categoryId = UUID.randomUUID();
        when(categoryRepository.findById(categoryId)).thenReturn(java.util.Optional.empty());

        CreateOfferRequest request = new CreateOfferRequest(
                "Smart 1 Go", categoryId, null, null, null, null, null, null, null, null, null, null);

        assertThrows(IllegalArgumentException.class, () -> offerService.create(request));
        org.mockito.Mockito.verify(offerRepository, org.mockito.Mockito.never()).save(any(Offer.class));
    }

    @Test
    void scoreDeQualite_estCalculeDesLaCreation() {
        UUID categoryId = offerCategory();
        CreateOfferRequest request = new CreateOfferRequest(
                "Offre complète", categoryId, "Courte", "Longue",
                new BigDecimal("9990"), "XOF",
                java.time.LocalDateTime.now(), java.time.LocalDateTime.now().plusDays(30),
                TargetSegment.PREPAID, CustomerType.INDIVIDUAL,
                "Mentions légales", List.of(UUID.randomUUID()));

        when(offerRepository.save(any(Offer.class))).thenAnswer(inv -> inv.getArgument(0));

        OfferResponse response = offerService.create(request);

        // Socle commercial complet (55) + descriptions courte et longue (20)
        // + mentions legales (10). Le referencement, qui releve de l'analyste,
        // n'est pas encore renseigne : le score ne peut donc pas etre au maximum.
        assertEquals(85f, response.qualityScore());
        assertTrue(response.qualityScore() < 100f,
                "une fiche sans référencement ne peut pas être complète à 100 %");
    }

    @Test
    void scoreDeQualite_resteBasSurUneFicheATrous() {
        CreateOfferRequest request = new CreateOfferRequest(
                "Brouillon", offerCategory(), null, null, null, null, null, null, null, null, null, null);

        when(offerRepository.save(any(Offer.class))).thenAnswer(inv -> inv.getArgument(0));

        OfferResponse response = offerService.create(request);

        // Seul le nom est renseigne : 10 points sur 100.
        assertEquals(10f, response.qualityScore());
    }

    /**
     * L'enrichissement complete la partie editoriale : le score doit progresser
     * au moment ou l'analyste rend son travail, sinon il ne mesure rien.
     */
    @Test
    void scoreDeQualite_progresseApresEnrichissement() {
        Offer offer = new Offer();
        offer.setName("Offre à enrichir");
        offer.setStatus(OfferStatus.IN_ENRICHMENT);
        offer.setCreatedById(userId);
        setId(offer, UUID.randomUUID());

        when(offerRepository.findById(any())).thenReturn(java.util.Optional.of(offer));
        when(offerRepository.save(any(Offer.class))).thenAnswer(inv -> inv.getArgument(0));

        float avant = offer.getQualityScore();
        OfferResponse apres = offerService.enrich(offer.getId(), new EnrichOfferRequest(
                "Courte", "Longue", "Titre SEO", "Description SEO", "Mentions"));

        assertTrue(apres.qualityScore() > avant,
                "le score doit refléter le travail d'enrichissement");
    }

    @Test
    void create_shouldReturnOfferInDraftStatus() {
        CreateOfferRequest request = new CreateOfferRequest(
                "Offre Internet 5G", offerCategory(), "Internet rapide", "Description longue",
                new BigDecimal("9990"), "XOF", null, null,
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

    @Test
    void update_shouldChangeCommercialFieldsAndLeaveEditorialOnesUntouched() {
        Offer offer = buildOffer(OfferStatus.DRAFT);
        offer.setShortDescription("Redige par l'analyste");
        offer.setSeoTitle("Titre SEO de l'analyste");
        when(offerRepository.findById(offer.getId())).thenReturn(Optional.of(offer));
        when(offerRepository.save(any(Offer.class))).thenAnswer(inv -> inv.getArgument(0));

        OfferResponse response = offerService.update(offer.getId(), new UpdateOfferRequest(
                "Offre revue", null, new BigDecimal("14990"), "EUR", null, null,
                TargetSegment.POSTPAID, CustomerType.BUSINESS, "Nouvelles mentions", null));

        assertEquals("Offre revue", response.name());
        assertEquals(new BigDecimal("14990"), response.promotionalPrice());
        assertEquals("EUR", response.currency());
        // Les champs de l'analyste marketing ne doivent pas bouger : c'est toute la
        // raison d'avoir deux endpoints distincts sur la meme fiche.
        assertEquals("Redige par l'analyste", offer.getShortDescription());
        assertEquals("Titre SEO de l'analyste", offer.getSeoTitle());
    }

    @Test
    void update_shouldBeAllowedAfterRejectionSoTheOwnerCanCorrect() {
        Offer offer = buildOffer(OfferStatus.IN_ENRICHMENT);
        when(offerRepository.findById(offer.getId())).thenReturn(Optional.of(offer));
        when(offerRepository.save(any(Offer.class))).thenAnswer(inv -> inv.getArgument(0));

        assertDoesNotThrow(() -> offerService.update(offer.getId(), new UpdateOfferRequest(
                "Corrigee", null, null, null, null, null, null, null, null, null)));
    }

    @ParameterizedTest
    @CsvSource({"VALIDATED", "PLANNED", "PUBLISHED", "ARCHIVED"})
    void update_shouldRefuseOnceTheOfferHasBeenApproved(OfferStatus status) {
        Offer offer = buildOffer(status);
        when(offerRepository.findById(offer.getId())).thenReturn(Optional.of(offer));

        assertThrows(IllegalStateException.class,
                () -> offerService.update(offer.getId(), new UpdateOfferRequest(
                        "Tentative", null, null, null, null, null, null, null, null, null)));
    }

    @Test
    void update_shouldKeepItemsWhenCompositionIsNotProvided() {
        Offer offer = buildOffer(OfferStatus.DRAFT);
        offer.addItem(new com.moov.pim.lifecycle.domain.OfferItem(UUID.randomUUID()));
        when(offerRepository.findById(offer.getId())).thenReturn(Optional.of(offer));
        when(offerRepository.save(any(Offer.class))).thenAnswer(inv -> inv.getArgument(0));

        offerService.update(offer.getId(), new UpdateOfferRequest(
                "Sans composition", null, null, null, null, null, null, null, null, null));

        assertEquals(1, offer.getItems().size());
    }

    @Test
    void assign_shouldDesignateAnAnalystWhoCanActuallyEnrich() {
        Offer offer = buildOffer(OfferStatus.IN_ENRICHMENT);
        UUID analystId = UUID.randomUUID();
        when(offerRepository.findById(offer.getId())).thenReturn(Optional.of(offer));
        when(offerRepository.save(any(Offer.class))).thenAnswer(inv -> inv.getArgument(0));
        when(userRepository.findById(analystId)).thenReturn(Optional.of(userWith("OFFER_ENRICH", analystId)));

        OfferResponse response = offerService.assign(offer.getId(), new AssignOfferRequest(analystId));

        assertEquals(analystId, response.assignedToId());
    }

    @Test
    void assign_shouldRefuseAnAccountThatCannotEnrich() {
        Offer offer = buildOffer(OfferStatus.IN_ENRICHMENT);
        UUID targetId = UUID.randomUUID();
        when(offerRepository.findById(offer.getId())).thenReturn(Optional.of(offer));
        // Un chef de service detient OFFER_VALIDATE, pas OFFER_ENRICH : lui confier
        // une fiche produirait une affectation que personne ne pourrait honorer.
        when(userRepository.findById(targetId)).thenReturn(Optional.of(userWith("OFFER_VALIDATE", targetId)));

        assertThrows(IllegalArgumentException.class,
                () -> offerService.assign(offer.getId(), new AssignOfferRequest(targetId)));
        assertNull(offer.getAssignedToId());
    }

    @Test
    void assign_shouldReleaseTheOfferWhenNoAnalystIsGiven() {
        Offer offer = buildOffer(OfferStatus.IN_ENRICHMENT);
        offer.setAssignedToId(UUID.randomUUID());
        when(offerRepository.findById(offer.getId())).thenReturn(Optional.of(offer));
        when(offerRepository.save(any(Offer.class))).thenAnswer(inv -> inv.getArgument(0));

        assertNull(offerService.assign(offer.getId(), new AssignOfferRequest(null)).assignedToId());
    }

    /** Compte porteur d'une seule permission, pour verifier le controle de la cible. */
    private User userWith(String permissionCode, UUID id) {
        try {
            var constructor = Role.class.getDeclaredConstructor();
            constructor.setAccessible(true);
            Role r = constructor.newInstance();
            Field perms = Role.class.getDeclaredField("permissions");
            perms.setAccessible(true);
            perms.set(r, new java.util.HashSet<>(java.util.List.of(new Permission(permissionCode, ""))));

            User u = new User("cible@moov.bf", "$2a$hash", "Cible", "Test", r);
            Field idField = User.class.getDeclaredField("id");
            idField.setAccessible(true);
            idField.set(u, id);
            return u;
        } catch (Exception e) {
            throw new RuntimeException(e);
        }
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
