package com.moov.pim.campaign.api.dto;

import com.moov.pim.campaign.domain.Campaign;

import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

public record CampaignResponse(
        UUID id,
        String name,
        UUID offerId,
        String status,
        LocalDateTime scheduledAt,
        LocalDateTime publishedAt,
        UUID createdById,
        LocalDateTime createdAt,
        List<ChannelResponse> channels
) {
    public record ChannelResponse(UUID id, String channelType, String status, LocalDateTime sentAt) {}

    public static CampaignResponse from(Campaign campaign) {
        List<ChannelResponse> channels = campaign.getChannels().stream()
                .map(ch -> new ChannelResponse(
                        ch.getId(), ch.getChannelType().name(),
                        ch.getStatus().name(), ch.getSentAt()))
                .toList();
        return new CampaignResponse(
                campaign.getId(), campaign.getName(), campaign.getOfferId(),
                campaign.getStatus().name(), campaign.getScheduledAt(),
                campaign.getPublishedAt(), campaign.getCreatedById(),
                campaign.getCreatedAt(), channels
        );
    }
}
