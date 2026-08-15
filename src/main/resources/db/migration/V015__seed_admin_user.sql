-- Utilisateur admin par défaut pour les tests
-- Mot de passe : Admin@2024 (hash bcrypt)
INSERT INTO users (id, email, password_hash, first_name, last_name, role_id, status, failed_login_attempts)
VALUES (
    'c0000000-0000-0000-0000-000000000001',
    'admin@moov-africa.bf',
    '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy',
    'Admin',
    'Système',
    'a0000000-0000-0000-0000-000000000001',
    'ACTIVE',
    0
);
