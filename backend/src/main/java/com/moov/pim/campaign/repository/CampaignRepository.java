package com.moov.pim.campaign.repository;

import com.moov.pim.campaign.domain.Campaign;
import com.moov.pim.campaign.domain.CampaignStatus;
import org.springframework.data.jpa.repository.JpaRepository;

import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

public interface CampaignRepository extends JpaRepository<Campaign, UUID> {

    List<Campaign> findByOfferId(UUID offerId);

    List<Campaign> findByCreatedById(UUID userId);

    List<Campaign> findByStatus(CampaignStatus status);

    List<Campaign> findByStatusAndScheduledAtBefore(CampaignStatus status, LocalDateTime now);
}
