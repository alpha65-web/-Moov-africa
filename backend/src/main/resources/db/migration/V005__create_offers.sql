CREATE TABLE offers (
    id                UUID PRIMARY KEY,
    name              VARCHAR(255)   NOT NULL,
    short_description VARCHAR(500),
    long_description  TEXT,
    seo_title         VARCHAR(255),
    seo_description   VARCHAR(500),
    status            VARCHAR(20)    NOT NULL DEFAULT 'DRAFT',
    promotional_price DECIMAL(15, 2),
    currency          VARCHAR(3)     NOT NULL DEFAULT 'XOF',
    valid_from        TIMESTAMP,
    valid_until       TIMESTAMP,
    target_segment    VARCHAR(20),
    customer_type     VARCHAR(20),
    quality_score     REAL           NOT NULL DEFAULT 0.0,
    publish_date      TIMESTAMP,
    legal_mentions    TEXT,
    created_by_id     UUID           NOT NULL REFERENCES users(id),
    enriched_by_id    UUID           REFERENCES users(id),
    current_version   BIGINT         NOT NULL DEFAULT 1,
    version           BIGINT         NOT NULL DEFAULT 0,
    created_at        TIMESTAMP      NOT NULL DEFAULT now(),
    updated_at        TIMESTAMP      NOT NULL DEFAULT now()
);

CREATE INDEX idx_offers_status     ON offers(status);
CREATE INDEX idx_offers_created_by ON offers(created_by_id);
CREATE INDEX idx_offers_valid      ON offers(valid_until) WHERE status IN ('PUBLISHED', 'SUSPENDED');
CREATE INDEX idx_offers_planned    ON offers(publish_date) WHERE status = 'PLANNED';

CREATE TABLE offer_items (
    id              UUID PRIMARY KEY,
    offer_id        UUID NOT NULL REFERENCES offers(id) ON DELETE CASCADE,
    catalog_item_id UUID NOT NULL REFERENCES catalog_items(id),
    UNIQUE (offer_id, catalog_item_id)
);

CREATE INDEX idx_offer_items_offer ON offer_items(offer_id);

CREATE TABLE offer_versions (
    id                 UUID PRIMARY KEY,
    offer_id           UUID      NOT NULL REFERENCES offers(id) ON DELETE CASCADE,
    version_number     BIGINT    NOT NULL,
    snapshot           JSONB     NOT NULL,
    changed_by_id      UUID      NOT NULL REFERENCES users(id),
    change_description VARCHAR(500),
    created_at         TIMESTAMP NOT NULL DEFAULT now(),
    UNIQUE (offer_id, version_number)
);

CREATE INDEX idx_offer_versions_offer ON offer_versions(offer_id);

CREATE TABLE offer_status_history (
    id            UUID PRIMARY KEY,
    offer_id      UUID        NOT NULL REFERENCES offers(id) ON DELETE CASCADE,
    from_status   VARCHAR(20),
    to_status     VARCHAR(20) NOT NULL,
    changed_by_id UUID        NOT NULL REFERENCES users(id),
    comment       TEXT,
    created_at    TIMESTAMP   NOT NULL DEFAULT now()
);

CREATE INDEX idx_offer_status_history_offer ON offer_status_history(offer_id);
