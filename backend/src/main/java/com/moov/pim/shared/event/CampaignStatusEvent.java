package com.moov.pim.shared.event;

import java.util.UUID;

public record CampaignStatusEvent(UUID campaignId, String campaignName, UUID userId, String status) {}
