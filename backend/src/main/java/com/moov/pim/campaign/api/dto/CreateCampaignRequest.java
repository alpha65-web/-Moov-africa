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
        /**
         * Visuel accompagnant la diffusion, a choisir parmi ceux deja rattaches
         * a l'offre et deja approuves. Facultatif : une campagne SMS ou USSD
         * n'en a pas. Le serveur refuse tout autre visuel — le community manager
         * designe, il ne depose pas.
         */
        UUID mediaAssetId,
        LocalDateTime scheduledAt,
        @NotEmpty List<ChannelConfig> channels
) {
    public record ChannelConfig(@NotNull ChannelType channelType, String message) {}
}
