package com.moov.pim.lifecycle.service;

import com.moov.pim.lifecycle.domain.Offer;
import com.moov.pim.lifecycle.repository.OfferRepository;
import com.moov.pim.permissions.domain.Role;
import com.moov.pim.permissions.domain.RoleName;
import com.moov.pim.permissions.domain.User;
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
    @Mock private ApplicationEventPublisher eventPublisher;
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
}
