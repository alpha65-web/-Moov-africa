INSERT INTO permissions (id, code, description) VALUES
    ('b0000000-0000-0000-0000-000000000016', 'CATALOG_WRITE', 'Modifier les éléments du catalogue et gérer les tests A/B');

INSERT INTO role_permissions (role_id, permission_id)
SELECT 'a0000000-0000-0000-0000-000000000001', id FROM permissions WHERE code = 'CATALOG_WRITE';

INSERT INTO role_permissions (role_id, permission_id)
SELECT 'a0000000-0000-0000-0000-000000000002', id FROM permissions WHERE code = 'CATALOG_WRITE';
