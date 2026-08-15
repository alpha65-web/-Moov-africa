CREATE TABLE kpi_events (
    id          UUID PRIMARY KEY,
    offer_id    UUID        REFERENCES offers(id),
    event_type  VARCHAR(40) NOT NULL,
    actor_id    UUID        NOT NULL REFERENCES users(id),
    duration_ms BIGINT,
    created_at  TIMESTAMP   NOT NULL DEFAULT now()
);

CREATE INDEX idx_kpi_events_offer ON kpi_events(offer_id);
CREATE INDEX idx_kpi_events_type  ON kpi_events(event_type);
CREATE INDEX idx_kpi_events_date  ON kpi_events(created_at);

CREATE TABLE kpi_configs (
    id                   UUID PRIMARY KEY,
    kpi_code             VARCHAR(60)  NOT NULL UNIQUE,
    label                VARCHAR(255) NOT NULL,
    enabled              BOOLEAN      NOT NULL DEFAULT true,
    threshold_expression VARCHAR(255),
    updated_by_id        UUID         REFERENCES users(id),
    updated_at           TIMESTAMP    NOT NULL DEFAULT now()
);
