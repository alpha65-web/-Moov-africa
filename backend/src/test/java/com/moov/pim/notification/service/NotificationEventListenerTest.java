package com.moov.pim.notification.service;

import com.moov.pim.notification.domain.NotificationType;
import com.moov.pim.permissions.domain.AccountStatus;
import com.moov.pim.permissions.domain.Role;
import com.moov.pim.permissions.domain.RoleName;
import com.moov.pim.permissions.domain.User;
import com.moov.pim.permissions.repository.UserRepository;
import com.moov.pim.shared.event.OfferTransitionEvent;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;

import java.lang.reflect.Field;
import java.util.List;
import java.util.UUID;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;

/**
 * Le circuit ne vaut que si chaque étape prévient l'acteur suivant.
 *
 * Ces tests remplacent ceux qui vérifiaient l'ancien comportement, lequel adressait
 * toute notification à l'auteur de l'action qui venait d'avoir lieu.
 */
@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class NotificationEventListenerTest {

    @Mock private NotificationService notificationService;
    @Mock private UserRepository userRepository;
    @InjectMocks private NotificationEventListener listener;

    private final UUID acteur = UUID.randomUUID();
    private final UUID auteurDeLOffre = UUID.randomUUID();
    private final UUID offerId = UUID.randomUUID();

    private User userWithId(UUID id) {
        try {
            var constructor = Role.class.getDeclaredConstructor();
            constructor.setAccessible(true);
            Role role = constructor.newInstance();
            Field nameField = Role.class.getDeclaredField("name");
            nameField.setAccessible(true);
            nameField.set(role, RoleName.ANALYSTE_MARKETING);

            User user = new User("destinataire@moov.bf", "$2a$hash", "Des", "Tinataire", role);
            Field idField = User.class.getDeclaredField("id");
            idField.setAccessible(true);
            idField.set(user, id);
            return user;
        } catch (Exception e) {
            throw new RuntimeException(e);
        }
    }

    private void holders(String permission, UUID... ids) {
        when(userRepository.findByPermissionCodeAndStatus(eq(permission), eq(AccountStatus.ACTIVE)))
                .thenReturn(List.of(ids).stream().map(this::userWithId).toList());
    }

    private OfferTransitionEvent event(String from, String to) {
        return new OfferTransitionEvent(offerId, "Mon Offre", acteur, auteurDeLOffre, from, to);
    }

    @Test
    void miseEnEnrichissement_previentLAnalysteEtPasLeSoumetteur() {
        UUID analyste = UUID.randomUUID();
        holders("OFFER_ENRICH", analyste);

        listener.on(event("DRAFT", "IN_ENRICHMENT"));

        verify(notificationService).send(eq(analyste), eq(NotificationType.ENRICHMENT_REQUIRED),
                eq("Enrichissement requis"), any(String.class), eq(offerId));
        verify(notificationService, never()).send(eq(acteur), any(), any(), any(), any());
    }

    @Test
    void soumission_previentLeValideur() {
        UUID chefDeService = UUID.randomUUID();
        holders("OFFER_VALIDATE", chefDeService);

        listener.on(event("IN_ENRICHMENT", "IN_VALIDATION"));

        verify(notificationService).send(eq(chefDeService), eq(NotificationType.VALIDATION_REQUIRED),
                eq("Validation requise"), any(String.class), eq(offerId));
    }

    /** Cas qui n'emettait aucune notification : personne n'apprenait qu'une offre attendait sa publication. */
    @Test
    void validation_previentCeluiQuiPublieEtLAuteur() {
        UUID chefDeDepartement = UUID.randomUUID();
        holders("OFFER_PUBLISH", chefDeDepartement);

        listener.on(event("IN_VALIDATION", "VALIDATED"));

        verify(notificationService).send(eq(chefDeDepartement), eq(NotificationType.STRATEGIC_VALIDATION),
                eq("Publication à arbitrer"), any(String.class), eq(offerId));
        verify(notificationService).send(eq(auteurDeLOffre), eq(NotificationType.STRATEGIC_VALIDATION),
                any(), any(), eq(offerId));
    }

    @Test
    void publication_previentLAuteurEtLeCommunityManager() {
        UUID communityManager = UUID.randomUUID();
        holders("CAMPAIGN_MANAGE", communityManager);

        listener.on(event("VALIDATED", "PUBLISHED"));

        verify(notificationService).send(eq(communityManager), eq(NotificationType.OFFER_PUBLISHED),
                eq("Offre publiée"), any(String.class), eq(offerId));
        verify(notificationService).send(eq(auteurDeLOffre), eq(NotificationType.OFFER_PUBLISHED),
                any(), any(), eq(offerId));
    }

    @Test
    void rejetDepuisLaValidation_renvoieVersLEnrichissementEtPrevientLAuteur() {
        UUID analyste = UUID.randomUUID();
        holders("OFFER_ENRICH", analyste);

        listener.on(event("IN_VALIDATION", "IN_ENRICHMENT"));

        verify(notificationService).send(eq(analyste), eq(NotificationType.OFFER_REJECTED),
                eq("Offre renvoyée en enrichissement"), any(String.class), eq(offerId));
        verify(notificationService).send(eq(auteurDeLOffre), eq(NotificationType.OFFER_REJECTED),
                any(), any(), eq(offerId));
    }

    /** Prévenir celui qui vient d'agir n'apporte rien : il est retiré des destinataires. */
    @Test
    void lActeurNestJamaisSonPropreDestinataire() {
        holders("OFFER_VALIDATE", acteur);

        listener.on(event("IN_ENRICHMENT", "IN_VALIDATION"));

        verifyNoInteractions(notificationService);
    }

    @Test
    void archivageEtStatutInconnu_nEmettentRien() {
        listener.on(event("WITHDRAWN", "ARCHIVED"));
        listener.on(event("DRAFT", "STATUT_INCONNU"));

        verifyNoInteractions(notificationService);
    }
}
