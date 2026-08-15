package com.moov.pim.campaign.api.dto;

import com.moov.pim.campaign.domain.ChannelType;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;

import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

public record CreateCampaignRequest(
        @NotBlank String name,
        @NotNull UUID offerId,
        LocalDateTime scheduledAt,
        @NotEmpty List<ChannelConfig> channels
) {
    public record ChannelConfig(@NotNull ChannelType channelType, String message) {}
}
