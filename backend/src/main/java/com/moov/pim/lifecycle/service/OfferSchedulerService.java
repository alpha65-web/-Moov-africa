package com.moov.pim.lifecycle.service;

import com.moov.pim.lifecycle.domain.Offer;
import com.moov.pim.lifecycle.domain.OfferStatus;
import com.moov.pim.lifecycle.repository.OfferRepository;
import com.moov.pim.shared.event.OfferExpiringEvent;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.List;

/**
 * Transitions declenchees par l'echeance et non par un acteur.
 *
 * Ces methodes ecrivaient auparavant le statut directement sur l'entite, puis
 * enregistraient. Consequence verifiee en deroulant le circuit : une offre
 * publiee automatiquement a sa date de mise en ligne n'etait ni historisee dans
 * offer_status_history, ni versionnee, et n'emettait aucun evenement. Elle
 * n'apparaissait donc pas au journal d'audit, son Time To Market n'etait jamais
 * cloture faute d'evenement STATUS_PUBLISHED, le community manager n'etait pas
 * prevenu, et surtout aucune diffusion ne partait vers les systemes tiers.
 *
 * Le meme circuit produisait ainsi deux resultats differents selon qu'il etait
 * acheve a la main ou a l'echeance. Tout passe desormais par
 * {@link OfferService#applyScheduledTransition}, qui emprunte exactement le meme
 * chemin qu'une transition declenchee par un acteur.
 */
@Service
public class OfferSchedulerService {

    private static final Logger log = LoggerFactory.getLogger(OfferSchedulerService.class);
    private static final DateTimeFormatter DATE = DateTimeFormatter.ofPattern("dd/MM/yyyy HH:mm");

    private final OfferRepository offerRepository;
    private final OfferService offerService;
    private final ApplicationEventPublisher eventPublisher;

    public OfferSchedulerService(OfferRepository offerRepository,
                                 OfferService offerService,
                                 ApplicationEventPublisher eventPublisher) {
        this.offerRepository = offerRepository;
        this.offerService = offerService;
        this.eventPublisher = eventPublisher;
    }

    /**
     * Publie les offres planifiees dont la date de mise en ligne est atteinte.
     *
     * La transition emprunte le circuit normal : elle est donc historisee, versionnee,
     * notifiee au community manager et suivie de la diffusion vers le CRM, le centre
     * d'appel et le site web.
     */
    @Scheduled(fixedRate = 60000)
    @Transactional
    public void publishPlannedOffers() {
        LocalDateTime now = LocalDateTime.now();
        List<Offer> planned = offerRepository.findPlannedReadyToPublish(now);

        for (Offer offer : planned) {
            try {
                offerService.applyScheduledTransition(offer, OfferStatus.PUBLISHED,
                        "Publication automatique à l'échéance planifiée du "
                                + (offer.getValidFrom() != null ? offer.getValidFrom().format(DATE) : "—"));
                log.info("Publication automatique de l'offre {} ({})", offer.getName(), offer.getId());
            } catch (RuntimeException e) {
                // Une offre en echec ne doit pas empecher les suivantes de partir.
                log.error("Publication automatique impossible pour l'offre {} ({}) : {}",
                        offer.getName(), offer.getId(), e.getMessage());
            }
        }
    }

    /**
     * Declasse les offres publiees dont la date de fin de validite est depassee.
     */
    @Scheduled(fixedRate = 60000)
    @Transactional
    public void expireOffers() {
        LocalDateTime now = LocalDateTime.now();
        List<Offer> expired = offerRepository.findExpiredOffers(now);

        for (Offer offer : expired) {
            try {
                offerService.applyScheduledTransition(offer, OfferStatus.OBSOLETE,
                        "Passage automatique en obsolète : date de fin de validité atteinte le "
                                + (offer.getValidUntil() != null ? offer.getValidUntil().format(DATE) : "—"));
                log.info("Expiration automatique de l'offre {} ({})", offer.getName(), offer.getId());
            } catch (RuntimeException e) {
                log.error("Expiration automatique impossible pour l'offre {} ({}) : {}",
                        offer.getName(), offer.getId(), e.getMessage());
            }
        }
    }

    /**
     * Previent des offres qui arrivent a echeance dans les sept jours.
     *
     * L'implementation precedente se contentait d'ecrire un avertissement dans le
     * journal technique du serveur : personne, dans l'application, n'apprenait
     * jamais qu'une offre allait expirer. Une alerte que son destinataire ne peut
     * pas voir n'est pas une alerte.
     */
    @Scheduled(fixedRate = 3600000)
    @Transactional
    public void alertExpiringOffers() {
        LocalDateTime now = LocalDateTime.now();
        LocalDateTime threshold = now.plusDays(7);
        List<Offer> expiring = offerRepository.findExpiringOffers(now, threshold);

        for (Offer offer : expiring) {
            eventPublisher.publishEvent(new OfferExpiringEvent(
                    offer.getId(), offer.getName(), offer.getCreatedById(),
                    offer.getValidUntil() != null ? offer.getValidUntil().format(DATE) : "—"));
        }
    }
}
