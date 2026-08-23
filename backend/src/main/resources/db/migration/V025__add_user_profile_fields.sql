-- Champs de profil utilisateur exposes par l'interface (telephone, pseudo, avatar).
-- Ils etaient saisis par le formulaire de creation sans jamais etre persistes.
ALTER TABLE users ADD COLUMN IF NOT EXISTS phone      VARCHAR(30);
ALTER TABLE users ADD COLUMN IF NOT EXISTS pseudo     VARCHAR(60);
ALTER TABLE users ADD COLUMN IF NOT EXISTS avatar_url TEXT;
