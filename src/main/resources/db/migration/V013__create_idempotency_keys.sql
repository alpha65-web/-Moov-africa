CREATE TABLE idempotency_keys (
    id          UUID PRIMARY KEY,
    key         VARCHAR(255) NOT NULL UNIQUE,
    entity_type VARCHAR(60)  NOT NULL,
    entity_id   UUID         NOT NULL,
    created_at  TIMESTAMP    NOT NULL DEFAULT now(),
    expires_at  TIMESTAMP    NOT NULL
);

CREATE INDEX idx_idempotency_keys_expires ON idempotency_keys(expires_at);
