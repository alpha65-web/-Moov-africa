-- Table parente (stratégie JOINED pour l'héritage CatalogItem)
CREATE TABLE catalog_items (
    id            UUID PRIMARY KEY,
    item_type     VARCHAR(20)    NOT NULL,
    name          VARCHAR(255)   NOT NULL,
    description   TEXT,
    status        VARCHAR(20)    NOT NULL DEFAULT 'ACTIVE',
    base_price    DECIMAL(15, 2),
    currency      VARCHAR(3)     NOT NULL DEFAULT 'XOF',
    category_id   UUID           NOT NULL REFERENCES categories(id),
    created_by_id UUID           NOT NULL REFERENCES users(id),
    version       BIGINT         NOT NULL DEFAULT 0,
    created_at    TIMESTAMP      NOT NULL DEFAULT now(),
    updated_at    TIMESTAMP      NOT NULL DEFAULT now()
);

CREATE INDEX idx_catalog_items_type     ON catalog_items(item_type);
CREATE INDEX idx_catalog_items_status   ON catalog_items(status);
CREATE INDEX idx_catalog_items_category ON catalog_items(category_id);

-- Sous-table Product
CREATE TABLE products (
    id              UUID PRIMARY KEY REFERENCES catalog_items(id),
    characteristics JSONB,
    pack_only       BOOLEAN NOT NULL DEFAULT false,
    quality_score   REAL    NOT NULL DEFAULT 0.0
);

CREATE INDEX idx_products_characteristics ON products USING GIN (characteristics);

-- Sous-table Service
CREATE TABLE services (
    id              UUID PRIMARY KEY REFERENCES catalog_items(id),
    service_type    VARCHAR(20) NOT NULL,
    characteristics JSONB,
    pack_only       BOOLEAN     NOT NULL DEFAULT false,
    billing_cycle   VARCHAR(20) NOT NULL DEFAULT 'MONTHLY'
);

-- Sous-table Pack
CREATE TABLE packs (
    id              UUID PRIMARY KEY REFERENCES catalog_items(id),
    bundle_price    DECIMAL(15, 2),
    bundle_discount DECIMAL(15, 2)
);

-- Composition d'un pack
CREATE TABLE pack_items (
    id              UUID PRIMARY KEY,
    pack_id         UUID NOT NULL REFERENCES packs(id) ON DELETE CASCADE,
    catalog_item_id UUID NOT NULL REFERENCES catalog_items(id),
    quantity        INT  NOT NULL DEFAULT 1,
    UNIQUE (pack_id, catalog_item_id)
);

CREATE INDEX idx_pack_items_pack ON pack_items(pack_id);

-- Détection de doublons
CREATE TABLE duplicate_flags (
    id                   UUID PRIMARY KEY,
    source_product_id    UUID    NOT NULL REFERENCES products(id),
    duplicate_product_id UUID    NOT NULL REFERENCES products(id),
    similarity_score     REAL    NOT NULL,
    resolved             BOOLEAN NOT NULL DEFAULT false,
    resolved_by_id       UUID    REFERENCES users(id),
    created_at           TIMESTAMP NOT NULL DEFAULT now(),
    CHECK (source_product_id <> duplicate_product_id)
);
