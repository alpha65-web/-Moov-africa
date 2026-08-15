CREATE TABLE integration_exports (
    id              UUID PRIMARY KEY,
    target_system   VARCHAR(30) NOT NULL,
    offer_id        UUID        REFERENCES offers(id),
    export_type     VARCHAR(30) NOT NULL,
    status          VARCHAR(20) NOT NULL DEFAULT 'PENDING',
    idempotency_key VARCHAR(255) NOT NULL,
    payload         JSONB,
    error_message   TEXT,
    retry_count     INT         NOT NULL DEFAULT 0,
    created_at      TIMESTAMP   NOT NULL DEFAULT now(),
    completed_at    TIMESTAMP
);

CREATE UNIQUE INDEX idx_integration_exports_idempotency ON integration_exports(idempotency_key);
CREATE INDEX idx_integration_exports_offer  ON integration_exports(offer_id);
CREATE INDEX idx_integration_exports_status ON integration_exports(status);
