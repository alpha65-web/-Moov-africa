-- MFA TOTP support
ALTER TABLE users ADD COLUMN totp_secret VARCHAR(64);
ALTER TABLE users ADD COLUMN totp_enabled BOOLEAN NOT NULL DEFAULT FALSE;

-- Enhanced audit trail
ALTER TABLE audit_logs ADD COLUMN user_agent VARCHAR(500);

-- Index for audit log queries by action (login tracking)
CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON audit_logs(action);
