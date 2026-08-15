CREATE TABLE campaigns (
    id            UUID PRIMARY KEY,
    name          VARCHAR(255) NOT NULL,
    offer_id      UUID         NOT NULL REFERENCES offers(id),
    status        VARCHAR(20)  NOT NULL DEFAULT 'DRAFT',
    scheduled_at  TIMESTAMP,
    published_at  TIMESTAMP,
    created_by_id UUID         NOT NULL REFERENCES users(id),
    created_at    TIMESTAMP    NOT NULL DEFAULT now()
);

CREATE INDEX idx_campaigns_offer ON campaigns(offer_id);

CREATE TABLE campaign_channels (
    id           UUID PRIMARY KEY,
    campaign_id  UUID        NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
    channel_type VARCHAR(30) NOT NULL,
    message      TEXT,
    status       VARCHAR(20) NOT NULL DEFAULT 'PENDING',
    sent_at      TIMESTAMP
);

CREATE INDEX idx_campaign_channels_campaign ON campaign_channels(campaign_id);

CREATE TABLE campaign_stats (
    id                  UUID PRIMARY KEY,
    campaign_channel_id UUID      NOT NULL UNIQUE REFERENCES campaign_channels(id) ON DELETE CASCADE,
    views               BIGINT    NOT NULL DEFAULT 0,
    clicks              BIGINT    NOT NULL DEFAULT 0,
    engagement          REAL      NOT NULL DEFAULT 0.0,
    updated_at          TIMESTAMP NOT NULL DEFAULT now()
);
