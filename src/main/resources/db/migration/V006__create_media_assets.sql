CREATE TABLE media_assets (
    id                UUID PRIMARY KEY,
    file_name         VARCHAR(255) NOT NULL,
    mime_type         VARCHAR(100) NOT NULL,
    file_size         BIGINT       NOT NULL,
    storage_key       VARCHAR(500) NOT NULL UNIQUE,
    width             INT,
    height            INT,
    resolution        INT,
    conformity_status VARCHAR(20)  NOT NULL DEFAULT 'PENDING',
    copyright_risk    BOOLEAN      NOT NULL DEFAULT false,
    parent_media_id   UUID         REFERENCES media_assets(id),
    media_version     INT          NOT NULL DEFAULT 1,
    uploaded_by_id    UUID         NOT NULL REFERENCES users(id),
    created_at        TIMESTAMP    NOT NULL DEFAULT now()
);

CREATE INDEX idx_media_assets_conformity ON media_assets(conformity_status);
CREATE INDEX idx_media_assets_parent     ON media_assets(parent_media_id);

CREATE TABLE offer_media (
    id             UUID PRIMARY KEY,
    offer_id       UUID    NOT NULL REFERENCES offers(id) ON DELETE CASCADE,
    media_asset_id UUID    NOT NULL REFERENCES media_assets(id),
    is_primary     BOOLEAN NOT NULL DEFAULT false,
    display_order  INT     NOT NULL DEFAULT 0,
    UNIQUE (offer_id, media_asset_id)
);

CREATE INDEX idx_offer_media_offer ON offer_media(offer_id);

CREATE TABLE media_validations (
    id              UUID PRIMARY KEY,
    media_asset_id  UUID        NOT NULL REFERENCES media_assets(id) ON DELETE CASCADE,
    status          VARCHAR(20) NOT NULL DEFAULT 'PENDING',
    annotation      TEXT,
    media_type      VARCHAR(20) NOT NULL,
    validated_by_id UUID        NOT NULL REFERENCES users(id),
    created_at      TIMESTAMP   NOT NULL DEFAULT now()
);

CREATE INDEX idx_media_validations_asset ON media_validations(media_asset_id);
