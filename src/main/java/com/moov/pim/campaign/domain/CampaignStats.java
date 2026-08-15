package com.moov.pim.campaign.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.OneToOne;
import jakarta.persistence.PreUpdate;
import jakarta.persistence.Table;

import java.time.LocalDateTime;
import java.util.UUID;

@Entity
@Table(name = "campaign_stats")
public class CampaignStats {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @OneToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "channel_id", nullable = false, unique = true)
    private CampaignChannel channel;

    @Column(nullable = false)
    private long views = 0;

    @Column(nullable = false)
    private long clicks = 0;

    @Column(nullable = false)
    private float engagement = 0f;

    @Column(name = "updated_at", nullable = false)
    private LocalDateTime updatedAt = LocalDateTime.now();

    protected CampaignStats() {}

    @PreUpdate
    void onUpdate() {
        updatedAt = LocalDateTime.now();
    }

    public UUID getId() { return id; }
    public CampaignChannel getChannel() { return channel; }
    public long getViews() { return views; }
    public void setViews(long views) { this.views = views; }
    public long getClicks() { return clicks; }
    public void setClicks(long clicks) { this.clicks = clicks; }
    public float getEngagement() { return engagement; }
    public void setEngagement(float engagement) { this.engagement = engagement; }
    public LocalDateTime getUpdatedAt() { return updatedAt; }
}
