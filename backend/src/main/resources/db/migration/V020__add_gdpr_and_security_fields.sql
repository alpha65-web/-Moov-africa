-- GDPR: add anonymization tracking
ALTER TABLE users ADD COLUMN IF NOT EXISTS anonymized_at TIMESTAMP;

-- Extend totp_secret column for encrypted values
ALTER TABLE users ALTER COLUMN totp_secret TYPE VARCHAR(512);

-- Index for audit log queries by action
CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON audit_logs(action);
CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id_created ON audit_logs(user_id, created_at DESC);
