-- Add sex column to users
ALTER TABLE users ADD COLUMN sex VARCHAR(20);

-- Add SUPER_ADMIN role with all permissions
INSERT INTO roles (id, name, description) VALUES
    ('a0000000-0000-0000-0000-000000000007', 'SUPER_ADMIN', 'Super Administrateur');

INSERT INTO role_permissions (role_id, permission_id)
SELECT 'a0000000-0000-0000-0000-000000000007', id FROM permissions;
