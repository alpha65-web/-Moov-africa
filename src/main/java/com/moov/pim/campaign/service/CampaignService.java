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
        return campaignRepository.findByOfferId(offerId).stream()
                .map(CampaignResponse::from)
                .toList();
    }

    @Transactional(readOnly = true)
    public List<CampaignResponse> listMyCampaigns() {
        return campaignRepository.findByCreatedById(currentUserId()).stream()
                .map(CampaignResponse::from)
                .toList();
    }

    @Transactional(readOnly = true)
    public CampaignResponse getById(UUID id) {
        Campaign campaign = campaignRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Campagne introuvable"));
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

    private UUID currentUserId() {
        CustomUserDetails principal = (CustomUserDetails) SecurityContextHolder
                .getContext().getAuthentication().getPrincipal();
        return principal.getUserId();
    }
}
