-- Comptes admin de démonstration (hashes BCrypt cost 12, mots de passe NON stockés en clair)
-- force_password_change = true : l'utilisateur devra changer son mot de passe à la première connexion

INSERT INTO users (id, email, password_hash, first_name, last_name, role_id, status, failed_login_attempts, force_password_change)
VALUES (
    'c0000000-0000-0000-0000-000000000002',
    'alpha@moov-africa.bf',
    '$2b$12$E2BNVCNy9Yx0PtuMTXIjYO9s0U7WwnE7ducHP/mCcHDqugVan266W',
    'Alpha',
    'Admin',
    'a0000000-0000-0000-0000-000000000001',
    'ACTIVE',
    0,
    true
) ON CONFLICT (id) DO NOTHING;

INSERT INTO users (id, email, password_hash, first_name, last_name, role_id, status, failed_login_attempts, force_password_change)
VALUES (
    'c0000000-0000-0000-0000-000000000003',
    'watta@moov-africa.bf',
    '$2b$12$3Gi6lUv4RtlRmKmTSWGy1OTtBGNSn1BTjq5rbtE8hlTCKqm/5RpTW',
    'Watta',
    'Admin',
    'a0000000-0000-0000-0000-000000000001',
    'ACTIVE',
    0,
    true
) ON CONFLICT (id) DO NOTHING;
