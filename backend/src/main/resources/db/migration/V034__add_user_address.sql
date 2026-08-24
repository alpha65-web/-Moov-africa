-- Adresse de l'utilisateur.
--
-- Le formulaire de creation de compte proposait deja un champ "Adresse"
-- (users/page.tsx), mais la valeur saisie n'existait ni dans RegisterRequest ni
-- en base : elle etait perdue a l'enregistrement, sans que l'ecran le signale.
-- La colonne est ajoutee et le champ traverse desormais toutes les couches, au
-- meme titre que phone et pseudo (V025).
ALTER TABLE users ADD COLUMN IF NOT EXISTS address VARCHAR(255);
