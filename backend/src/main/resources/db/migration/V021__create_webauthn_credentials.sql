CREATE TABLE webauthn_credentials (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID         NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    credential_id   VARCHAR(1024) NOT NULL UNIQUE,
    public_key_cose TEXT         NOT NULL,
    signature_count BIGINT       NOT NULL DEFAULT 0,
    user_handle     VARCHAR(512) NOT NULL,
    name            VARCHAR(255),
    transports      VARCHAR(512),
    discoverable    BOOLEAN      NOT NULL DEFAULT false,
    created_at      TIMESTAMP    NOT NULL DEFAULT now(),
    last_used_at    TIMESTAMP
);

CREATE INDEX idx_webauthn_user_id ON webauthn_credentials(user_id);
CREATE INDEX idx_webauthn_credential_id ON webauthn_credentials(credential_id);
CREATE INDEX idx_webauthn_user_handle ON webauthn_credentials(user_handle);
