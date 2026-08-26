package com.moov.pim.campaign.service;

import com.moov.pim.campaign.api.dto.CampaignResponse;
import com.moov.pim.campaign.api.dto.CreateCampaignRequest;
import com.moov.pim.campaign.domain.Campaign;
import com.moov.pim.campaign.domain.CampaignChannel;
import com.moov.pim.campaign.domain.CampaignStatus;
import com.moov.pim.campaign.domain.ChannelStatus;
import com.moov.pim.campaign.repository.CampaignRepository;
import com.moov.pim.lifecycle.domain.OfferStatus;
import com.moov.pim.lifecycle.repository.OfferRepository;
import com.moov.pim.permissions.security.CustomUserDetails;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

@Service
public class CampaignService {

    private static final Logger log = LoggerFactory.getLogger(CampaignService.class);

    private final CampaignRepository campaignRepository;
    private final OfferRepository offerRepository;

    public CampaignService(CampaignRepository campaignRepository, OfferRepository offerRepository) {
        this.campaignRepository = campaignRepository;
        this.offerRepository = offerRepository;
    }

    @Transactional
    public CampaignResponse create(CreateCampaignRequest request) {
        Campaign campaign = new Campaign();
        campaign.setName(request.name());
        campaign.setOfferId(request.offerId());
        campaign.setCreatedById(currentUserId());
        campaign.setScheduledAt(request.scheduledAt());

        for (CreateCampaignRequest.ChannelConfig channelConfig : request.channels()) {
            CampaignChannel channel = new CampaignChannel();
            channel.setChannelType(channelConfig.channelType());
            channel.setMessage(channelConfig.message());
            campaign.addChannel(channel);
        }

        if (request.scheduledAt() != null) {
            campaign.setStatus(CampaignStatus.SCHEDULED);
        }

        campaign = campaignRepository.save(campaign);
        return CampaignResponse.from(campaign);
    }

    @Transactional(readOnly = true)
    public List<CampaignResponse> listByOffer(UUID offerId) {
        List<Campaign> campaigns = campaignRepository.findByOfferId(offerId);
        if (!hasTransversalScope()) {
            UUID userId = currentUserId();
            campaigns = campaigns.stream()
                    .filter(c -> c.getCreatedById().equals(userId))
                    .toList();
        }
        return campaigns.stream()
                .map(CampaignResponse::from)
                .toList();
    }

    @Transactional(readOnly = true)
    /**
     * Les roles a perimetre transversal ont une vue globale, comme sur le catalogue
     * et les offres. Sans cela l'ecran Campagnes restait vide alors meme que des
     * campagnes existaient.
     */
    public List<CampaignResponse> listMyCampaigns() {
        List<Campaign> campaigns = hasTransversalScope()
                ? campaignRepository.findAll()
                : campaignRepository.findByCreatedById(currentUserId());
        return campaigns.stream()
                .map(CampaignResponse::from)
                .toList();
    }

    @Transactional(readOnly = true)
    public CampaignResponse getById(UUID id) {
        Campaign campaign = campaignRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Campagne introuvable"));
        checkOwnership(campaign);
        return CampaignResponse.from(campaign);
    }

    @Transactional
    public CampaignResponse update(UUID id, CreateCampaignRequest request) {
        Campaign campaign = campaignRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Campagne introuvable"));
        checkOwnership(campaign);

        if (campaign.getStatus() != CampaignStatus.DRAFT && campaign.getStatus() != CampaignStatus.SCHEDULED) {
            throw new IllegalStateException("Seule une campagne en DRAFT ou SCHEDULED peut être modifiée");
        }

        campaign.setName(request.name());
        campaign.setOfferId(request.offerId());
        campaign.setScheduledAt(request.scheduledAt());
        campaign.getChannels().clear();

        for (CreateCampaignRequest.ChannelConfig channelConfig : request.channels()) {
            CampaignChannel channel = new CampaignChannel();
            channel.setChannelType(channelConfig.channelType());
            channel.setMessage(channelConfig.message());
            campaign.addChannel(channel);
        }

        if (request.scheduledAt() != null) {
            campaign.setStatus(CampaignStatus.SCHEDULED);
        } else {
            campaign.setStatus(CampaignStatus.DRAFT);
        }

        campaign = campaignRepository.save(campaign);
        return CampaignResponse.from(campaign);
    }

    @Transactional
    public void delete(UUID id) {
        Campaign campaign = campaignRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Campagne introuvable"));
        checkOwnership(campaign);

        if (campaign.getStatus() == CampaignStatus.PUBLISHED || campaign.getStatus() == CampaignStatus.COMPLETED) {
            throw new IllegalStateException("Impossible de supprimer une campagne publiée ou terminée");
        }

        campaignRepository.delete(campaign);
    }

    @Transactional
    public CampaignResponse cancel(UUID id) {
        Campaign campaign = campaignRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Campagne introuvable"));
        checkOwnership(campaign);

        if (campaign.getStatus() == CampaignStatus.COMPLETED || campaign.getStatus() == CampaignStatus.CANCELLED) {
            throw new IllegalStateException("Impossible d'annuler une campagne terminée ou déjà annulée");
        }

        campaign.setStatus(CampaignStatus.CANCELLED);
        campaign = campaignRepository.save(campaign);
        return CampaignResponse.from(campaign);
    }

    /**
     * Diffuse immediatement une campagne, sans attendre d'echeance.
     *
     * Une campagne creee sans date planifiee restait DRAFT indefiniment : rien
     * dans l'application ne pouvait la mettre en ligne, il fallait la rouvrir pour
     * lui donner une echeance et attendre le passage du planificateur. L'ecran
     * proposait donc une campagne qu'aucun geste ne permettait de diffuser.
     *
     * La diffusion est refusee si l'offre promue n'est pas publiee. Annoncer une
     * offre encore en brouillon, suspendue ou retiree adresserait aux clients une
     * offre qu'ils ne peuvent pas souscrire : c'est le seul controle qui empeche
     * cette action d'ouvrir une breche que le planificateur, lui, n'ouvre pas —
     * une campagne planifiee l'a ete alors que l'offre etait en ligne.
     */
    @Transactional
    public CampaignResponse publishNow(UUID id) {
        Campaign campaign = campaignRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Campagne introuvable"));
        checkOwnership(campaign);

        if (campaign.getStatus() != CampaignStatus.DRAFT
                && campaign.getStatus() != CampaignStatus.SCHEDULED) {
            throw new IllegalStateException(
                    "Seule une campagne en brouillon ou planifiée peut être diffusée : "
                            + "celle-ci est " + campaign.getStatus());
        }

        OfferStatus offerStatus = offerRepository.findById(campaign.getOfferId())
                .map(offer -> offer.getStatus())
                .orElseThrow(() -> new IllegalArgumentException(
                        "L'offre promue par cette campagne est introuvable"));

        if (offerStatus != OfferStatus.PUBLISHED) {
            throw new IllegalStateException(
                    "L'offre promue n'est pas publiée (" + offerStatus + ") : "
                            + "diffuser cette campagne annoncerait une offre indisponible");
        }

        LocalDateTime now = LocalDateTime.now();
        campaign.setStatus(CampaignStatus.PUBLISHED);
        campaign.setPublishedAt(now);
        markChannelsDistributed(campaign, now);

        campaign = campaignRepository.save(campaign);
        log.info("Diffusion immediate de la campagne {} ({})", campaign.getName(), campaign.getId());
        return CampaignResponse.from(campaign);
    }

    /**
     * Marque les canaux en attente comme diffuses a la date donnee.
     *
     * Ce que SENT atteste ici : la plateforme a mis le message a disposition du
     * canal. Ce n'est pas un accuse de reception d'operateur — le referentiel
     * n'est pas une passerelle SMS et n'en recoit aucun retour. Meme portee que le
     * statut SUCCESS des exports d'integration. Un canal deja en echec n'est pas
     * repris : seul l'etat d'attente evolue.
     */
    private static void markChannelsDistributed(Campaign campaign, LocalDateTime moment) {
        for (CampaignChannel channel : campaign.getChannels()) {
            if (channel.getStatus() == ChannelStatus.PENDING) {
                channel.setStatus(ChannelStatus.SENT);
                channel.setSentAt(moment);
            }
        }
    }

    /**
     * Met en ligne les campagnes dont l'echeance est atteinte.
     *
     * Chaque canal est marque diffuse au passage. Sans cela, une campagne
     * annoncee « publiee » gardait indefiniment ses canaux a PENDING et l'ecran
     * affichait « Non diffuse » sur une campagne pourtant en ligne :
     * ChannelStatus.SENT n'etait ecrit nulle part dans le code, et sent_at restait
     * vide. L'interface contredisait donc l'etat de la campagne.
     *
     * Ce que SENT signifie ici, precisement : la plateforme a mis le message a
     * disposition du canal a cette date. Ce n'est pas un accuse de reception
     * d'operateur — le referentiel n'est pas une passerelle SMS et n'en recoit
     * aucun retour. C'est la meme portee que le statut SUCCESS des exports
     * d'integration : ce qui est atteste, c'est la mise a disposition du contenu,
     * pas sa remise au destinataire final. Le libelle de l'ecran dit « diffuse »
     * et non « envoye » pour cette raison.
     *
     * Un canal deja en echec n'est pas repris : seul l'etat d'attente evolue.
     */
    @Scheduled(fixedRate = 60000)
    @Transactional
    public void publishScheduledCampaigns() {
        LocalDateTime now = LocalDateTime.now();
        List<Campaign> scheduled = campaignRepository.findByStatusAndScheduledAtBefore(
                CampaignStatus.SCHEDULED, now);

        for (Campaign campaign : scheduled) {
            campaign.setStatus(CampaignStatus.PUBLISHED);
            campaign.setPublishedAt(now);

            markChannelsDistributed(campaign, now);
            campaignRepository.save(campaign);
            log.info("Publication automatique de la campagne {} ({}), {} canal/canaux diffuse(s)",
                    campaign.getName(), campaign.getId(), campaign.getChannels().size());
        }
    }

    private void checkOwnership(Campaign campaign) {
        if (!hasTransversalScope() && !campaign.getCreatedById().equals(currentUserId())) {
            throw new AccessDeniedException("Accès interdit : cette campagne ne vous appartient pas");
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
