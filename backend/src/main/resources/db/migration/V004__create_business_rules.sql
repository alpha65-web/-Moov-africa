CREATE TABLE business_rules (
    id                UUID PRIMARY KEY,
    name              VARCHAR(255) NOT NULL,
    rule_type         VARCHAR(30)  NOT NULL,
    source_item_id    UUID         NOT NULL REFERENCES catalog_items(id),
    target_item_id    UUID         NOT NULL REFERENCES catalog_items(id),
    description       TEXT,
    active            BOOLEAN      NOT NULL DEFAULT true,
    created_by_id     UUID         NOT NULL REFERENCES users(id),
    created_at        TIMESTAMP    NOT NULL DEFAULT now(),
    CHECK (source_item_id <> target_item_id)
);

CREATE INDEX idx_business_rules_source ON business_rules(source_item_id);
CREATE INDEX idx_business_rules_target ON business_rules(target_item_id);
CREATE INDEX idx_business_rules_type   ON business_rules(rule_type);
