-- 6 rôles fixes
INSERT INTO roles (id, name, description) VALUES
    ('a0000000-0000-0000-0000-000000000001', 'ADMIN_SYSTEME',       'Administrateur système'),
    ('a0000000-0000-0000-0000-000000000002', 'CHEF_PRODUIT',        'Chef de produit'),
    ('a0000000-0000-0000-0000-000000000003', 'ANALYSTE_MARKETING',  'Analyste marketing'),
    ('a0000000-0000-0000-0000-000000000004', 'CHEF_SERVICE',        'Chef de service'),
    ('a0000000-0000-0000-0000-000000000005', 'CHEF_DEPARTEMENT',    'Chef de département marketing et produits'),
    ('a0000000-0000-0000-0000-000000000006', 'COMMUNITY_MANAGER',   'Community Manager');

-- Permissions
INSERT INTO permissions (id, code, description) VALUES
    ('b0000000-0000-0000-0000-000000000001', 'USER_MANAGE',         'Gérer les comptes utilisateurs'),
    ('b0000000-0000-0000-0000-000000000002', 'CATALOG_READ',        'Consulter le catalogue'),
    ('b0000000-0000-0000-0000-000000000003', 'CATALOG_MANAGE',      'Créer/modifier/archiver des éléments du catalogue'),
    ('b0000000-0000-0000-0000-000000000004', 'RULE_MANAGE',         'Gérer les règles métier'),
    ('b0000000-0000-0000-0000-000000000005', 'OFFER_CREATE',        'Créer une offre'),
    ('b0000000-0000-0000-0000-000000000006', 'OFFER_ENRICH',        'Enrichir une offre (descriptions, SEO, médias)'),
    ('b0000000-0000-0000-0000-000000000007', 'OFFER_SUBMIT',        'Soumettre une offre pour validation'),
    ('b0000000-0000-0000-0000-000000000008', 'OFFER_VALIDATE',      'Valider/rejeter une offre (niveau opérationnel)'),
    ('b0000000-0000-0000-0000-000000000009', 'OFFER_PUBLISH',       'Publier/planifier/suspendre une offre'),
    ('b0000000-0000-0000-0000-000000000010', 'MEDIA_UPLOAD',        'Déposer des médias'),
    ('b0000000-0000-0000-0000-000000000011', 'MEDIA_VALIDATE',      'Valider/rejeter des médias (circuit graphique)'),
    ('b0000000-0000-0000-0000-000000000012', 'CAMPAIGN_MANAGE',     'Gérer les campagnes de diffusion'),
    ('b0000000-0000-0000-0000-000000000013', 'ANALYTICS_VIEW',      'Consulter les KPIs et analytique'),
    ('b0000000-0000-0000-0000-000000000014', 'AUDIT_VIEW',          'Consulter l''historique complet + rollback'),
    ('b0000000-0000-0000-0000-000000000015', 'CONFIG_MANAGE',       'Configurer les notifications et indicateurs');

-- Affectation des permissions par rôle

-- Admin : toutes les permissions
INSERT INTO role_permissions (role_id, permission_id)
SELECT 'a0000000-0000-0000-0000-000000000001', id FROM permissions;

-- Chef de produit
INSERT INTO role_permissions (role_id, permission_id)
SELECT 'a0000000-0000-0000-0000-000000000002', id FROM permissions
WHERE code IN ('CATALOG_READ', 'CATALOG_MANAGE', 'RULE_MANAGE', 'OFFER_CREATE', 'OFFER_SUBMIT', 'MEDIA_UPLOAD');

-- Analyste marketing
INSERT INTO role_permissions (role_id, permission_id)
SELECT 'a0000000-0000-0000-0000-000000000003', id FROM permissions
WHERE code IN ('CATALOG_READ', 'OFFER_ENRICH', 'MEDIA_UPLOAD');

-- Chef de service
INSERT INTO role_permissions (role_id, permission_id)
SELECT 'a0000000-0000-0000-0000-000000000004', id FROM permissions
WHERE code IN ('CATALOG_READ', 'OFFER_VALIDATE', 'MEDIA_VALIDATE');

-- Chef de département
INSERT INTO role_permissions (role_id, permission_id)
SELECT 'a0000000-0000-0000-0000-000000000005', id FROM permissions
WHERE code IN ('CATALOG_READ', 'OFFER_PUBLISH', 'ANALYTICS_VIEW');

-- Community Manager
INSERT INTO role_permissions (role_id, permission_id)
SELECT 'a0000000-0000-0000-0000-000000000006', id FROM permissions
WHERE code IN ('CATALOG_READ', 'CAMPAIGN_MANAGE');
