CREATE TABLE ab_tests (
    id            UUID PRIMARY KEY,
    offer_id      UUID        NOT NULL REFERENCES offers(id) ON DELETE CASCADE,
    variant_a     TEXT        NOT NULL,
    variant_b     TEXT        NOT NULL,
    metric        VARCHAR(100) NOT NULL,
    status        VARCHAR(20) NOT NULL DEFAULT 'RUNNING',
    winner        VARCHAR(1),
    created_by_id UUID        NOT NULL REFERENCES users(id),
    created_at    TIMESTAMP   NOT NULL DEFAULT now()
);

CREATE INDEX idx_ab_tests_offer ON ab_tests(offer_id);
