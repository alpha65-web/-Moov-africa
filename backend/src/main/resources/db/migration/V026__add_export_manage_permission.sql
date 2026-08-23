-- Les endpoints d'export etaient les seuls a s'appuyer sur un role (hasRole ADMIN_SYSTEME)
-- au lieu d'une permission. Cela excluait SUPER_ADMIN et empechait l'interface de
-- filtrer le menu de la meme facon que pour les autres modules.
INSERT INTO permissions (id, code, description) VALUES
    ('b0000000-0000-0000-0000-000000000017', 'EXPORT_MANAGE', 'Declencher et consulter les exports vers les systemes tiers')
ON CONFLICT (code) DO NOTHING;

-- ADMIN_SYSTEME et SUPER_ADMIN
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r, permissions p
WHERE r.name IN ('ADMIN_SYSTEME', 'SUPER_ADMIN') AND p.code = 'EXPORT_MANAGE'
ON CONFLICT DO NOTHING;
