CREATE TABLE ai_usage_logs (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    task        VARCHAR(50) NOT NULL,
    user_id     UUID NOT NULL REFERENCES users(id),
    entity_type VARCHAR(50),
    entity_id   UUID,
    model       VARCHAR(100) NOT NULL,
    input_tokens  INT NOT NULL DEFAULT 0,
    output_tokens INT NOT NULL DEFAULT 0,
    latency_ms    BIGINT NOT NULL DEFAULT 0,
    success     BOOLEAN NOT NULL DEFAULT true,
    error_message TEXT,
    created_at  TIMESTAMP NOT NULL DEFAULT now()
);

CREATE INDEX idx_ai_usage_user_id ON ai_usage_logs(user_id);
CREATE INDEX idx_ai_usage_created_at ON ai_usage_logs(created_at);
CREATE INDEX idx_ai_usage_task ON ai_usage_logs(task);
