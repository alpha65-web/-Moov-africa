-- Token version: incremented on password change to invalidate all existing tokens
ALTER TABLE users ADD COLUMN token_version integer NOT NULL DEFAULT 0;

-- Force password change flag (for seeded admin accounts)
ALTER TABLE users ADD COLUMN force_password_change boolean NOT NULL DEFAULT false;

-- Refresh token storage for revocation support
CREATE TABLE refresh_tokens (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_hash  VARCHAR(64) NOT NULL UNIQUE,
    expires_at  TIMESTAMP NOT NULL,
    revoked     BOOLEAN NOT NULL DEFAULT false,
    created_at  TIMESTAMP NOT NULL DEFAULT now()
);

CREATE INDEX idx_refresh_tokens_user_id ON refresh_tokens(user_id);
CREATE INDEX idx_refresh_tokens_token_hash ON refresh_tokens(token_hash);
CREATE INDEX idx_refresh_tokens_expires_at ON refresh_tokens(expires_at);

-- Force the seeded admin to change password on first login
UPDATE users SET force_password_change = true WHERE email = 'admin@moov-africa.bf';
