package com.moov.pim.campaign.service;

import com.moov.pim.campaign.api.dto.CampaignResponse;
import com.moov.pim.campaign.api.dto.CreateCampaignRequest;
import com.moov.pim.campaign.domain.Campaign;
import com.moov.pim.campaign.domain.CampaignChannel;
import com.moov.pim.campaign.domain.CampaignStatus;
import com.moov.pim.campaign.repository.CampaignRepository;
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

    public CampaignService(CampaignRepository campaignRepository) {
        this.campaignRepository = campaignRepository;
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

    @Scheduled(fixedRate = 60000)
    @Transactional
    public void publishScheduledCampaigns() {
        LocalDateTime now = LocalDateTime.now();
        List<Campaign> scheduled = campaignRepository.findByStatusAndScheduledAtBefore(
                CampaignStatus.SCHEDULED, now);

        for (Campaign campaign : scheduled) {
            campaign.setStatus(CampaignStatus.PUBLISHED);
            campaign.setPublishedAt(now);
            campaignRepository.save(campaign);
            log.info("Publication automatique de la campagne {} ({})", campaign.getName(), campaign.getId());
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
