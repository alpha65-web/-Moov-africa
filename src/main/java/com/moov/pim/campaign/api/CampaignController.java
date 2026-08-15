package com.moov.pim.campaign.api;

import com.moov.pim.campaign.api.dto.CampaignResponse;
import com.moov.pim.campaign.api.dto.CreateCampaignRequest;
import com.moov.pim.campaign.service.CampaignService;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/campaigns")
public class CampaignController {

    private final CampaignService campaignService;

    public CampaignController(CampaignService campaignService) {
        this.campaignService = campaignService;
    }

    @PostMapping
    @PreAuthorize("hasAuthority('CAMPAIGN_MANAGE')")
    public ResponseEntity<CampaignResponse> create(@Valid @RequestBody CreateCampaignRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED).body(campaignService.create(request));
    }

    @GetMapping("/mine")
    @PreAuthorize("hasAuthority('CAMPAIGN_MANAGE')")
    public ResponseEntity<List<CampaignResponse>> myCampaigns() {
        return ResponseEntity.ok(campaignService.listMyCampaigns());
    }

    @GetMapping("/offers/{offerId}")
    @PreAuthorize("hasAuthority('CAMPAIGN_MANAGE')")
    public ResponseEntity<List<CampaignResponse>> byOffer(@PathVariable UUID offerId) {
        return ResponseEntity.ok(campaignService.listByOffer(offerId));
    }

    @GetMapping("/{id}")
    @PreAuthorize("hasAuthority('CAMPAIGN_MANAGE')")
    public ResponseEntity<CampaignResponse> getById(@PathVariable UUID id) {
        return ResponseEntity.ok(campaignService.getById(id));
    }
}
