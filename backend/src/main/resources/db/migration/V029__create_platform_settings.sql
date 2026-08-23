-- Reglages generaux de la plateforme (nom, langue par defaut, devise, fuseau).
-- L'onglet "General" de l'ecran Parametres les affichait depuis des constantes
-- codees en dur et son bouton Enregistrer ne persistait rien.
--
-- La table ne contient qu'une seule ligne : la contrainte singleton garantit
-- qu'aucune seconde configuration ne peut etre inseree par erreur.
CREATE TABLE platform_settings (
    id               INT          PRIMARY KEY DEFAULT 1 CHECK (id = 1),
    platform_name    VARCHAR(120) NOT NULL DEFAULT 'Moov Africa PIM',
    default_language VARCHAR(10)  NOT NULL DEFAULT 'fr',
    currency         VARCHAR(10)  NOT NULL DEFAULT 'XOF',
    timezone         VARCHAR(60)  NOT NULL DEFAULT 'Africa/Ouagadougou',
    updated_by_id    UUID         REFERENCES users(id),
    updated_at       TIMESTAMP    NOT NULL DEFAULT now()
);

INSERT INTO platform_settings (id) VALUES (1) ON CONFLICT (id) DO NOTHING;
