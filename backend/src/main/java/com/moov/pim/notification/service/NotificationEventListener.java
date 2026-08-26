package com.moov.pim.notification.service;

import com.moov.pim.notification.domain.NotificationType;
import com.moov.pim.notification.repository.NotificationRepository;
import com.moov.pim.permissions.domain.AccountStatus;
import com.moov.pim.permissions.domain.User;
import com.moov.pim.permissions.repository.UserRepository;
import com.moov.pim.shared.event.OfferAssignedEvent;
import com.moov.pim.shared.event.OfferExpiringEvent;
import com.moov.pim.shared.event.OfferTransitionEvent;
import org.springframework.modulith.events.ApplicationModuleListener;
import org.springframework.stereotype.Component;

import java.util.LinkedHashSet;
import java.util.Set;
import java.util.UUID;

/**
 * Adresse chaque changement de statut à l'acteur qui doit intervenir ensuite.
 *
 * L'implémentation précédente envoyait la notification à {@code event.userId()},
 * c'est-à-dire à l'auteur de l'action qui venait d'avoir lieu — la seule personne
 * qui n'a pas besoin d'être prévenue. Vérifié en déroulant un circuit complet :
 * « Enrichissement requis » et « Validation requise » arrivaient toutes deux au chef
 * de produit qui venait de soumettre, et « Offre publiée » au chef de service qui
 * venait de publier. Personne en aval n'était jamais alerté, et le statut VALIDATED
 * n'émettait rien du tout : le chef de département n'apprenait jamais qu'une offre
 * attendait sa décision de publication.
 *
 * Les destinataires sont désormais désignés par la permission de l'étape suivante,
 * et non par un rôle en dur : si la matrice des permissions change, le routage suit.
 */
@Component
public class NotificationEventListener {

    private final NotificationService notificationService;
    private final NotificationRepository notificationRepository;
    private final UserRepository userRepository;

    public NotificationEventListener(NotificationService notificationService,
                                     NotificationRepository notificationRepository,
                                     UserRepository userRepository) {
        this.notificationService = notificationService;
        this.notificationRepository = notificationRepository;
        this.userRepository = userRepository;
    }

    /**
     * @param permission   permission des acteurs à prévenir, {@code null} si la
     *                     notification ne concerne que l'auteur de l'offre
     * @param notifyAuthor faut-il informer l'auteur de la fiche de la décision prise
     */
    private record Routing(NotificationType type, String title, String message,
                           String permission, boolean notifyAuthor) {}

    @ApplicationModuleListener
    public void on(OfferTransitionEvent event) {
        Routing routing = routingFor(event.fromStatus(), event.toStatus(), event.offerName());
        if (routing == null) return;

        Set<UUID> recipients = new LinkedHashSet<>();
        if (routing.permission() != null) {
            // Une offre confiee a un analyste precis ne concerne que lui : prevenir
            // toute l'equipe ferait travailler deux personnes sur la meme fiche, et
            // noierait les autres sous des alertes qui ne les regardent pas. Tant
            // que la fiche n'est pas repartie, tous les titulaires sont prevenus.
            if ("OFFER_ENRICH".equals(routing.permission()) && event.assignedToId() != null) {
                recipients.add(event.assignedToId());
            } else {
                userRepository.findByPermissionCodeAndStatus(routing.permission(), AccountStatus.ACTIVE)
                        .stream().map(User::getId).forEach(recipients::add);
            }
        }
        if (routing.notifyAuthor() && event.createdById() != null) {
            recipients.add(event.createdById());
        }
        // Celui qui vient d'agir sait ce qu'il a fait : le prévenir n'apporte rien.
        recipients.remove(event.userId());

        for (UUID recipient : recipients) {
            notificationService.send(recipient, routing.type(), routing.title(),
                    routing.message(), event.offerId());
        }
    }

    /**
     * Prévient l'analyste qu'une fiche vient de lui être confiée.
     *
     * L'affectation était silencieuse. Or le chef de service répartit le travail
     * au moment où il constate la charge de chacun, donc le plus souvent *après*
     * le passage en enrichissement : la notification de transition était alors
     * déjà partie, et l'analyste désigné n'apprenait jamais que la fiche était
     * pour lui. Une libération de fiche (analyste nul) ne notifie personne : il
     * n'y a plus de destinataire, et l'ancien titulaire le verra à sa file.
     */
    @ApplicationModuleListener
    public void on(OfferAssignedEvent event) {
        if (event.analystId() == null || event.analystId().equals(event.assignedById())) return;

        notificationService.send(event.analystId(), NotificationType.ENRICHMENT_REQUIRED,
                "Offre qui vous est confiée",
                "L'offre « " + event.offerName() + " » vous a été confiée pour enrichissement.",
                event.offerId());
    }

    /**
     * Prévient l'auteur qu'une de ses offres publiées arrive à échéance.
     *
     * Le balayage est horaire : sans le contrôle de doublon, l'auteur recevrait la
     * même alerte à chaque passage pendant les sept derniers jours de validité.
     */
    @ApplicationModuleListener
    public void on(OfferExpiringEvent event) {
        if (event.createdById() == null) return;
        if (notificationRepository.existsByRecipientIdAndTypeAndRelatedOfferId(
                event.createdById(), NotificationType.OFFER_EXPIRING, event.offerId())) {
            return;
        }

        notificationService.send(event.createdById(), NotificationType.OFFER_EXPIRING,
                "Offre bientôt expirée",
                "L'offre « " + event.offerName() + " » cesse d'être valide le " + event.validUntil()
                        + " : prolongez-la ou préparez son remplacement.",
                event.offerId());
    }

    private Routing routingFor(String fromStatus, String toStatus, String offerName) {
        String offer = "L'offre « " + offerName + " » ";
        return switch (toStatus) {
            // Un retour en enrichissement depuis la validation est un rejet : l'analyste
            // doit reprendre les contenus, et l'auteur doit savoir que son offre est
            // repartie en arrière.
            case "IN_ENRICHMENT" -> "IN_VALIDATION".equals(fromStatus)
                    ? new Routing(NotificationType.OFFER_REJECTED, "Offre renvoyée en enrichissement",
                        offer + "a été refusée en validation et doit être reprise.",
                        "OFFER_ENRICH", true)
                    : new Routing(NotificationType.ENRICHMENT_REQUIRED, "Enrichissement requis",
                        offer + "attend son enrichissement : descriptions, référencement et mentions légales.",
                        "OFFER_ENRICH", false);

            case "IN_VALIDATION" -> new Routing(NotificationType.VALIDATION_REQUIRED,
                    "Validation requise",
                    offer + "est soumise et attend votre validation opérationnelle.",
                    "OFFER_VALIDATE", false);

            case "VALIDATED" -> new Routing(NotificationType.STRATEGIC_VALIDATION,
                    "Publication à arbitrer",
                    offer + "est validée et attend votre décision de mise sur le marché.",
                    "OFFER_PUBLISH", true);

            case "PLANNED" -> new Routing(NotificationType.CAMPAIGN_READY,
                    "Offre planifiée",
                    offer + "est planifiée : la campagne de diffusion peut être préparée.",
                    "CAMPAIGN_MANAGE", true);

            case "PUBLISHED" -> new Routing(NotificationType.OFFER_PUBLISHED,
                    "Offre publiée",
                    offer + "est publiée sur l'ensemble des canaux.",
                    "CAMPAIGN_MANAGE", true);

            case "SUSPENDED", "WITHDRAWN", "OBSOLETE" -> new Routing(NotificationType.OFFER_REJECTED,
                    "Offre retirée du marché",
                    offer + "est passée en " + toStatus + ".",
                    null, true);

            case "DRAFT" -> new Routing(NotificationType.OFFER_REJECTED,
                    "Offre renvoyée au brouillon",
                    offer + "a été renvoyée à son auteur.",
                    null, true);

            // ARCHIVED et tout statut inconnu : rien à signaler à personne.
            default -> null;
        };
    }
}
