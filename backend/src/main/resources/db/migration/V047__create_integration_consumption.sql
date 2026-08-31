-- Consommation temps reel de l'information produit par les systemes tiers.
--
-- Le sujet impose que « l'information produit soit consommee en temps reel par
-- differents canaux : API ou export pour le CRM ou le centre d'appel ». Ni l'un
-- ni l'autre n'existait reellement :
--
--   * aucune API de consommation n'etait exposee — /exports ne sert que
--     l'administration interne et exige un jeton d'utilisateur de la plateforme,
--     qu'un systeme tiers n'a pas ;
--   * la remise elle-meme etait fictive : IntegrationExportService.deliver()
--     basculait l'export en SUCCESS sans appeler personne, son propre journal
--     indiquant « adaptateur de destination non raccorde ». L'ecran annoncait
--     donc « diffuse » alors que rien ne partait et que rien ne pouvait etre lu.
--
-- Cette migration installe les deux canaux et rend le statut verifiable :
--   1. integration_endpoints : l'URL reelle de chaque systeme destinataire. Si
--      elle est renseignee, la fiche part en HTTP et le statut suit le code de
--      reponse. C'est le canal « push ».
--   2. integration_api_keys : les cles remises aux systemes tiers pour interroger
--      /feed. C'est le canal « pull ». Un export non pousse reste PENDING —
--      « mise a disposition, pas encore lue » — et ne passe en SUCCESS que
--      lorsque le destinataire l'a effectivement lue.
--
-- Aucun statut ne peut donc plus affirmer une diffusion qui n'a pas eu lieu.

CREATE TABLE integration_endpoints (
    target_system VARCHAR(30)  PRIMARY KEY,
    url           VARCHAR(500),
    auth_header   VARCHAR(255),
    active        BOOLEAN      NOT NULL DEFAULT false,
    updated_by_id UUID         REFERENCES users(id),
    updated_at    TIMESTAMP    NOT NULL DEFAULT now()
);

INSERT INTO integration_endpoints (target_system) VALUES ('CRM'), ('CALL_CENTER'), ('WEBSITE')
ON CONFLICT (target_system) DO NOTHING;

-- Cle d'acces d'un systeme tiers. Seule l'empreinte est conservee : la valeur en
-- clair n'est montree qu'une fois, a la creation, comme pour tout secret.
CREATE TABLE integration_api_keys (
    id            UUID         PRIMARY KEY,
    label         VARCHAR(120) NOT NULL,
    target_system VARCHAR(30)  NOT NULL,
    key_hash      VARCHAR(128) NOT NULL UNIQUE,
    key_prefix    VARCHAR(16)  NOT NULL,
    active        BOOLEAN      NOT NULL DEFAULT true,
    created_by_id UUID         REFERENCES users(id),
    created_at    TIMESTAMP    NOT NULL DEFAULT now(),
    last_used_at  TIMESTAMP,
    call_count    BIGINT       NOT NULL DEFAULT 0,
    revoked_at    TIMESTAMP
);

CREATE INDEX idx_integration_api_keys_hash   ON integration_api_keys(key_hash);
CREATE INDEX idx_integration_api_keys_target ON integration_api_keys(target_system);

-- Tracabilite de la remise, cote export.
ALTER TABLE integration_exports ADD COLUMN delivery_mode  VARCHAR(10);
ALTER TABLE integration_exports ADD COLUMN endpoint_url   VARCHAR(500);
ALTER TABLE integration_exports ADD COLUMN http_status    INT;
ALTER TABLE integration_exports ADD COLUMN consumed_at    TIMESTAMP;
ALTER TABLE integration_exports ADD COLUMN consumed_count INT NOT NULL DEFAULT 0;

-- Les exports deja enregistres ont ete marques SUCCESS sans qu'aucune remise
-- n'ait eu lieu. Les laisser tels quels reconduirait le mensonge dans le nouvel
-- ecran : ils repassent en PENDING, c'est-a-dire « fiche constituee, en attente
-- d'etre lue », ce qui est exactement leur etat reel. Ils redeviendront SUCCESS
-- des que le systeme destinataire les aura consommes.
UPDATE integration_exports
   SET status        = 'PENDING',
       delivery_mode = 'PULL',
       completed_at  = NULL
 WHERE status = 'SUCCESS';

UPDATE integration_exports SET delivery_mode = 'PULL' WHERE delivery_mode IS NULL;

-- Permission de consultation du flux, portee par les cles et non par un role.
INSERT INTO permissions (id, code, description) VALUES
    ('b0000000-0000-0000-0000-000000000020', 'FEED_CONSUME',
     'Lire le flux des offres publiees via une cle de consommation')
ON CONFLICT (code) DO NOTHING;
