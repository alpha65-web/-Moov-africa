CREATE TABLE audit_logs (
    id             UUID PRIMARY KEY,
    user_id        UUID        NOT NULL REFERENCES users(id),
    action         VARCHAR(30) NOT NULL,
    entity_type    VARCHAR(60) NOT NULL,
    entity_id      UUID        NOT NULL,
    previous_value JSONB,
    new_value      JSONB,
    ip_address     VARCHAR(45),
    created_at     TIMESTAMP   NOT NULL DEFAULT now()
);

CREATE INDEX idx_audit_logs_user   ON audit_logs(user_id);
CREATE INDEX idx_audit_logs_entity ON audit_logs(entity_type, entity_id);
CREATE INDEX idx_audit_logs_date   ON audit_logs(created_at);
