-- Force password change for the default admin account seeded in V015
UPDATE users SET force_password_change = true
WHERE id = 'c0000000-0000-0000-0000-000000000001'
  AND force_password_change IS NOT TRUE;
