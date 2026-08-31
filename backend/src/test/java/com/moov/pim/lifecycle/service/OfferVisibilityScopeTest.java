package com.moov.pim.lifecycle.service;

import com.moov.pim.lifecycle.api.dto.OfferResponse;
import com.moov.pim.lifecycle.domain.Offer;
import com.moov.pim.lifecycle.domain.OfferStatus;
import com.moov.pim.lifecycle.repository.OfferRepository;
import com.moov.pim.permissions.domain.Permission;
import com.moov.pim.permissions.domain.Role;
import com.moov.pim.permissions.domain.RoleName;
import com.moov.pim.permissions.domain.User;
import com.moov.pim.permissions.repository.UserRepository;
import com.moov.pim.permissions.security.CustomUserDetails;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.InjectMocks;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;

import java.lang.reflect.Field;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.ArgumentMatchers.isNull;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * Perimetres de visibilite exiges par le cahier des charges.
 *
 * « un chef de produit ne voit que les offres qu'il a lui-meme creees, jamais
 *   celles des autres chefs de produit »
 * « le chef de service a une vue transversale sur plusieurs chefs de produit et
 *   voit qui a cree quelle offre/produit »
 *
 * Ces regles n'etaient couvertes par aucun test : le service ramenait tout role
 * non administrateur a ses propres fiches, ce qui privait le chef de service, le
 * chef de departement et l'analyste marketing de toute offre a traiter.
 */
@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class OfferVisibilityScopeTest {

    @Mock private OfferRepository offerRepository;
    @Mock private com.moov.pim.catalog.repository.CategoryRepository categoryRepository;
    @Mock private ApplicationEventPublisher eventPublisher;
    @Mock private UserRepository userRepository;
    @InjectMocks private OfferService offerService;

    private UUID authenticate(RoleName roleName) throws Exception {
        var constructor = Role.class.getDeclaredConstructor();
        constructor.setAccessible(true);
        Role role = constructor.newInstance();
        Field nameField = Role.class.getDeclaredField("name");
        nameField.setAccessible(true);
        nameField.set(role, roleName);

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

    private Offer offerCreatedBy(UUID ownerId) {
        Offer offer = new Offer();
        offer.setCreatedById(ownerId);
        return offer;
    }

    @AfterEach
    void tearDown() {
        SecurityContextHolder.clearContext();
    }

    @Test
    void chefDeProduit_neVoitQueSesPropresOffres() throws Exception {
        UUID userId = authenticate(RoleName.CHEF_PRODUIT);
        Pageable pageable = PageRequest.of(0, 20);
        Page<Offer> empty = new PageImpl<>(List.of());
        when(offerRepository.searchByOwner(isNull(), isNull(), eq(userId), any())).thenReturn(empty);

        offerService.search(null, null, pageable);

        verify(offerRepository).searchByOwner(isNull(), isNull(), eq(userId), any());
        verify(offerRepository, never()).search(any(), any(), any());
    }

    @Test
    void chefDeService_aUneVueTransversale() throws Exception {
        authenticate(RoleName.CHEF_SERVICE);
        Pageable pageable = PageRequest.of(0, 20);
        when(offerRepository.search(isNull(), isNull(), any())).thenReturn(new PageImpl<>(List.of()));

        offerService.search(null, null, pageable);

        verify(offerRepository).search(isNull(), isNull(), any());
        verify(offerRepository, never()).searchByOwner(any(), any(), any(), any());
    }

    /**
     * Les compteurs du tableau de bord suivent le meme perimetre que la liste.
     *
     * Un comptage global renverrait a un chef de produit le nombre total d'offres
     * de la plateforme : il ne verrait aucune des fiches des autres acteurs, mais
     * saurait combien il y en a. Le cloisonnement doit valoir pour les nombres
     * comme pour les lignes.
     */
    @Test
    void statistiques_chefDeProduit_neComptentQueSesPropresOffres() throws Exception {
        UUID userId = authenticate(RoleName.CHEF_PRODUIT);
        when(offerRepository.countGroupedByStatusForOwner(userId))
                .thenReturn(List.of(statusCount(OfferStatus.DRAFT, 3)));

        var stats = offerService.statsByStatus();

        assertEquals(3, stats.total());
        assertEquals(3L, stats.byStatus().get("DRAFT"));
        verify(offerRepository).countGroupedByStatusForOwner(userId);
        verify(offerRepository, never()).countGroupedByStatus();
    }

    @Test
    void statistiques_chefDeService_comptentToutesLesOffres() throws Exception {
        authenticate(RoleName.CHEF_SERVICE);
        when(offerRepository.countGroupedByStatus())
                .thenReturn(List.of(statusCount(OfferStatus.PUBLISHED, 7),
                                    statusCount(OfferStatus.IN_VALIDATION, 2)));

        var stats = offerService.statsByStatus();

        assertEquals(9, stats.total());
        verify(offerRepository).countGroupedByStatus();
        verify(offerRepository, never()).countGroupedByStatusForOwner(any());
    }

    /**
     * Un statut sans aucune offre ne produit pas de ligne en base. S'il manquait
     * de la reponse, l'anneau de repartition ferait disparaitre l'etape au lieu
     * de l'afficher a zero.
     */
    @Test
    void statistiques_portentLesDixStatutsMemeAZero() throws Exception {
        authenticate(RoleName.CHEF_SERVICE);
        when(offerRepository.countGroupedByStatus())
                .thenReturn(List.of(statusCount(OfferStatus.DRAFT, 1)));

        var stats = offerService.statsByStatus();

        assertEquals(OfferStatus.values().length, stats.byStatus().size());
        assertEquals(0L, stats.byStatus().get("ARCHIVED"));
        assertEquals(1, stats.total());
    }

    private static OfferRepository.StatusCount statusCount(OfferStatus status, long total) {
        return new OfferRepository.StatusCount() {
            @Override public OfferStatus getStatus() { return status; }
            @Override public long getTotal() { return total; }
        };
    }

    @Test
    void chefDeDepartement_analysteEtCommunityManager_ontUneVueTransversale() throws Exception {
        for (RoleName roleName : List.of(RoleName.CHEF_DEPARTEMENT, RoleName.ANALYSTE_MARKETING,
                RoleName.COMMUNITY_MANAGER, RoleName.ADMIN_SYSTEME, RoleName.SUPER_ADMIN)) {
            assertTrue(roleName.hasTransversalScope(),
                    roleName + " doit voir les fiches de tous les acteurs");
        }
        assertFalse(RoleName.CHEF_PRODUIT.hasTransversalScope(),
                "CHEF_PRODUIT reste cloisonne a ses propres fiches");
    }

    /**
     * Le compte administrateur livre (alpha@) ne peut pas etre teste par appel reel :
     * il exige un mot de passe et un code TOTP que seul son titulaire detient. Le
     * chemin de code, lui, est verifie ici : ADMIN_SYSTEME doit emprunter la requete
     * non filtree, comme le chef de service.
     */
    @Test
    void administrateur_interrogeLaRequeteNonFiltree() throws Exception {
        authenticate(RoleName.ADMIN_SYSTEME);
        when(offerRepository.search(isNull(), isNull(), any())).thenReturn(new PageImpl<>(List.of()));

        offerService.search(null, null, PageRequest.of(0, 20));

        verify(offerRepository).search(isNull(), isNull(), any());
        verify(offerRepository, never()).searchByOwner(any(), any(), any(), any());
    }

    @Test
    void administrateur_peutOuvrirNimporteQuelleOffre() throws Exception {
        authenticate(RoleName.ADMIN_SYSTEME);
        UUID offerId = UUID.randomUUID();
        when(offerRepository.findById(offerId))
                .thenReturn(Optional.of(offerCreatedBy(UUID.randomUUID())));

        assertDoesNotThrow(() -> offerService.getById(offerId));
    }

    @Test
    void chefDeService_peutOuvrirUneOffreDunAutreActeur() throws Exception {
        authenticate(RoleName.CHEF_SERVICE);
        UUID offerId = UUID.randomUUID();
        when(offerRepository.findById(offerId))
                .thenReturn(Optional.of(offerCreatedBy(UUID.randomUUID())));

        assertDoesNotThrow(() -> offerService.getById(offerId));
    }

    @Test
    void chefDeProduit_nePeutPasOuvrirLOffreDunAutre() throws Exception {
        authenticate(RoleName.CHEF_PRODUIT);
        UUID offerId = UUID.randomUUID();
        when(offerRepository.findById(offerId))
                .thenReturn(Optional.of(offerCreatedBy(UUID.randomUUID())));

        assertThrows(AccessDeniedException.class, () -> offerService.getById(offerId));
    }

    // ===================================================================
    // Perimetre du community manager
    //
    // Le cahier des charges (l. 107) borne son acces a « la consultation des
    // offres publiees ». Le serveur lui renvoyait pourtant la totalite du
    // catalogue, brouillons des autres acteurs compris ; seule l'interface les
    // masquait. La meme specification (l. 118) exige que le perimetre de
    // visibilite soit verifie cote serveur, « jamais uniquement dans l'interface ».
    // ===================================================================

    @Test
    void communityManager_neVoitQueLesOffresDiffusables() throws Exception {
        authenticateWithPermissions(RoleName.COMMUNITY_MANAGER, "CATALOG_READ", "CAMPAIGN_MANAGE");
        when(offerRepository.searchWithinStatuses(any(), isNull(), any()))
                .thenReturn(new PageImpl<>(List.of()));

        offerService.search(null, null, PageRequest.of(0, 20));

        verify(offerRepository).searchWithinStatuses(any(), isNull(), any());
        verify(offerRepository, never()).search(any(), any(), any());
        verify(offerRepository, never()).searchByOwner(any(), any(), any(), any());
    }

    /**
     * Demander explicitement un statut interne ne doit pas ouvrir une porte que le
     * perimetre ferme : la requete est intersectee, pas remplacee.
     */
    @Test
    void communityManager_neVoitRienEnDemandantLesBrouillons() throws Exception {
        authenticateWithPermissions(RoleName.COMMUNITY_MANAGER, "CATALOG_READ", "CAMPAIGN_MANAGE");

        Page<OfferResponse> result = offerService.search(
                OfferStatus.DRAFT, null, PageRequest.of(0, 20));

        assertTrue(result.isEmpty());
        verify(offerRepository, never()).searchWithinStatuses(any(), any(), any());
        verify(offerRepository, never()).search(any(), any(), any());
    }

    @Test
    void communityManager_nePeutPasOuvrirUnBrouillon() throws Exception {
        authenticateWithPermissions(RoleName.COMMUNITY_MANAGER, "CATALOG_READ", "CAMPAIGN_MANAGE");
        UUID offerId = UUID.randomUUID();
        Offer brouillon = offerCreatedBy(UUID.randomUUID());
        brouillon.setStatus(OfferStatus.DRAFT);
        when(offerRepository.findById(offerId)).thenReturn(Optional.of(brouillon));

        assertThrows(AccessDeniedException.class, () -> offerService.getById(offerId));
    }

    @Test
    void communityManager_peutOuvrirUneOffrePubliee() throws Exception {
        authenticateWithPermissions(RoleName.COMMUNITY_MANAGER, "CATALOG_READ", "CAMPAIGN_MANAGE");
        UUID offerId = UUID.randomUUID();
        Offer publiee = offerCreatedBy(UUID.randomUUID());
        publiee.setStatus(OfferStatus.PUBLISHED);
        when(offerRepository.findById(offerId)).thenReturn(Optional.of(publiee));

        assertDoesNotThrow(() -> offerService.getById(offerId));
    }

    /**
     * L'administrateur detient CAMPAIGN_MANAGE comme toutes les autres permissions :
     * il ne doit pas pour autant etre pris pour un role de diffusion et perdre
     * l'acces aux fiches en cours.
     */
    @Test
    void administrateur_nEstPasUnRoleDeDiffusion() throws Exception {
        authenticateWithPermissions(RoleName.ADMIN_SYSTEME,
                "CATALOG_READ", "CAMPAIGN_MANAGE", "OFFER_CREATE", "OFFER_PUBLISH");
        UUID offerId = UUID.randomUUID();
        Offer brouillon = offerCreatedBy(UUID.randomUUID());
        brouillon.setStatus(OfferStatus.DRAFT);
        when(offerRepository.findById(offerId)).thenReturn(Optional.of(brouillon));

        assertDoesNotThrow(() -> offerService.getById(offerId));
    }

    // ===================================================================
    // Divulgation de l'auteur d'une fiche
    //
    // « le chef de service a une vue transversale sur plusieurs chefs de produit
    //   et voit qui a cree quelle offre » (l. 114)
    // « les chefs de produit entre eux ne voient jamais qui a cree quel produit »
    //   (l. 115)
    //
    // Seul createdById existait : un identifiant technique qu'aucun ecran ne
    // resolvait. La capacite qui distingue le chef de service des autres
    // valideurs etait donc inapplicable.
    // ===================================================================

    @Test
    void chefDeService_voitLeNomDeLauteurDeLaFiche() throws Exception {
        authenticateWithPermissions(RoleName.CHEF_SERVICE, "CATALOG_READ", "OFFER_VALIDATE");
        UUID auteurId = UUID.randomUUID();
        UUID offerId = UUID.randomUUID();
        Offer offre = offerCreatedBy(auteurId);
        offre.setStatus(OfferStatus.IN_VALIDATION);

        when(offerRepository.findById(offerId)).thenReturn(Optional.of(offre));
        when(userRepository.findAllById(any())).thenReturn(List.of(userNamed(auteurId, "Awa", "Sawadogo")));

        OfferResponse response = offerService.getById(offerId);

        assertEquals("Awa Sawadogo", response.createdByName());
    }

    /**
     * Le community manager a une vue transversale, mais il diffuse des offres
     * publiees : l'organisation interne qui les a produites ne le regarde pas.
     */
    @Test
    void communityManager_neVoitPasLauteurDeLaFiche() throws Exception {
        authenticateWithPermissions(RoleName.COMMUNITY_MANAGER, "CATALOG_READ", "CAMPAIGN_MANAGE");
        UUID offerId = UUID.randomUUID();
        Offer offre = offerCreatedBy(UUID.randomUUID());
        offre.setStatus(OfferStatus.PUBLISHED);

        when(offerRepository.findById(offerId)).thenReturn(Optional.of(offre));

        OfferResponse response = offerService.getById(offerId);

        assertNull(response.createdByName());
        // Le nom n'est pas seulement masque a l'ecran : il n'est meme pas resolu.
        verify(userRepository, never()).findAllById(any());
    }

    @Test
    void chefDeProduit_neVoitAucunNomDauteur() throws Exception {
        UUID userId = authenticateWithPermissions(RoleName.CHEF_PRODUIT, "CATALOG_READ", "OFFER_CREATE");
        UUID offerId = UUID.randomUUID();
        Offer offre = offerCreatedBy(userId);

        when(offerRepository.findById(offerId)).thenReturn(Optional.of(offre));

        OfferResponse response = offerService.getById(offerId);

        assertNull(response.createdByName());
        verify(userRepository, never()).findAllById(any());
    }

    @Test
    void chefDeService_voitAussiLanalysteDesigne() throws Exception {
        authenticateWithPermissions(RoleName.CHEF_SERVICE, "CATALOG_READ", "OFFER_VALIDATE");
        UUID auteurId = UUID.randomUUID();
        UUID analysteId = UUID.randomUUID();
        UUID offerId = UUID.randomUUID();
        Offer offre = offerCreatedBy(auteurId);
        offre.setStatus(OfferStatus.IN_ENRICHMENT);
        offre.setAssignedToId(analysteId);

        when(offerRepository.findById(offerId)).thenReturn(Optional.of(offre));
        when(userRepository.findAllById(any())).thenReturn(List.of(
                userNamed(auteurId, "Awa", "Sawadogo"),
                userNamed(analysteId, "Moussa", "Ouedraogo")));

        OfferResponse response = offerService.getById(offerId);

        assertEquals("Awa Sawadogo", response.createdByName());
        assertEquals("Moussa Ouedraogo", response.assignedToName());
    }

    private static User userNamed(UUID id, String firstName, String lastName) throws Exception {
        var roleConstructor = Role.class.getDeclaredConstructor();
        roleConstructor.setAccessible(true);
        Role role = roleConstructor.newInstance();
        setPrivateField(Role.class, role, "name", RoleName.CHEF_PRODUIT);

        User user = new User("compte@moov.bf", "$2a$hash", firstName, lastName, role);
        setPrivateField(User.class, user, "id", id);
        return user;
    }

    private UUID authenticateWithPermissions(RoleName roleName, String... permissionCodes)
            throws Exception {
        var roleConstructor = Role.class.getDeclaredConstructor();
        roleConstructor.setAccessible(true);
        Role role = roleConstructor.newInstance();
        setPrivateField(Role.class, role, "name", roleName);
        setPrivateField(Role.class, role, "id", UUID.randomUUID());

        java.util.Set<Permission> permissions = new java.util.LinkedHashSet<>();
        for (String code : permissionCodes) {
            var permissionConstructor = Permission.class.getDeclaredConstructor();
            permissionConstructor.setAccessible(true);
            Permission permission = permissionConstructor.newInstance();
            setPrivateField(Permission.class, permission, "code", code);
            setPrivateField(Permission.class, permission, "id", UUID.randomUUID());
            permissions.add(permission);
        }
        setPrivateField(Role.class, role, "permissions", permissions);

        User user = new User("acteur@moov.bf", "$2a$hash", "Acteur", "Test", role);
        UUID userId = UUID.randomUUID();
        setPrivateField(User.class, user, "id", userId);

        CustomUserDetails details = new CustomUserDetails(user);
        SecurityContextHolder.getContext().setAuthentication(
                new UsernamePasswordAuthenticationToken(details, null, details.getAuthorities()));
        return userId;
    }

    private static void setPrivateField(Class<?> type, Object target, String fieldName, Object value)
            throws Exception {
        Field field = type.getDeclaredField(fieldName);
        field.setAccessible(true);
        field.set(target, value);
    }
}
