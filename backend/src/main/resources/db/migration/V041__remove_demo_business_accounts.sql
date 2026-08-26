-- Ne conserver que les comptes reellement crees par l'equipe.
--
-- Neuf comptes coexistaient : sept poses par les migrations de demonstration
-- (V022 pour alpha@, V032 pour les cinq roles metier, V036 pour le second chef
-- de produit) et deux crees depuis l'ecran Utilisateurs. Les comptes de
-- demonstration et le jeu de donnees qu'ils portaient sont retires ; seul le
-- compte administrateur alpha@ est conserve, faute de quoi la plateforme
-- deviendrait impossible a administrer (plus aucun titulaire de USER_MANAGE).
--
-- Comptes conserves :
--   alpha@moov-africa.bf        ADMIN_SYSTEME      (V022)
--   houecycqe3@moov-africa.bf   CHEF_PRODUIT       (cree depuis l'interface)
--   eouajcwymu@moov-africa.bf   ANALYSTE_MARKETING (cree depuis l'interface)
--
-- Comme V033, la suppression ne peut pas etre directe : dix-neuf colonnes
-- referencent users(id) et la quasi-totalite est en NO ACTION. Chaque reference
-- est traitee explicitement ci-dessous.
--
-- Les deux comptes conserves n'existent que dans la base ou ils ont ete crees :
-- sur une base reconstruite a zero, ils sont absents. Les transferts ci-dessous
-- retombent alors sur alpha@, seul compte garanti present, plutot que d'echouer
-- sur une violation de cle etrangere.

-- ============================================================
-- 0. REFERENTIEL DE TRAVAIL
-- ============================================================
CREATE TEMP TABLE demo_users ON COMMIT DROP AS
SELECT id FROM users WHERE email IN (
    'chef.produit@moov-africa.bf',
    'chef.service@moov-africa.bf',
    'chef.departement@moov-africa.bf',
    'community.manager@moov-africa.bf',
    'analyste.marketing@moov-africa.bf',
    'chef.produit2@moov-africa.bf'
);

-- Cibles de reprise. COALESCE : le compte metier s'il existe, sinon l'administrateur.
CREATE TEMP TABLE reprise ON COMMIT DROP AS
SELECT
    COALESCE((SELECT id FROM users WHERE email = 'houecycqe3@moov-africa.bf'),
             (SELECT id FROM users WHERE email = 'alpha@moov-africa.bf')) AS chef_produit,
    COALESCE((SELECT id FROM users WHERE email = 'eouajcwymu@moov-africa.bf'),
             (SELECT id FROM users WHERE email = 'alpha@moov-africa.bf')) AS analyste,
    (SELECT id FROM users WHERE email = 'alpha@moov-africa.bf')            AS admin;

-- ============================================================
-- 1. TRANSFERTS PREALABLES
--    Trois elements ont ete produits ou repris par les comptes conserves et
--    doivent leur survivre. Ils sont transferes AVANT toute suppression : une
--    fois leur paternite changee, ils sortent d'eux-memes du perimetre des
--    suppressions ci-dessous, qui ciblent les contenus des comptes de demo.
-- ============================================================

-- L'offre « Pack Famille Fibre Mobile » a ete enrichie depuis le compte analyste
-- conserve : son historique et ses versions lui appartiennent deja en totalite.
-- Seule sa paternite change de main.
UPDATE offers SET created_by_id = (SELECT chef_produit FROM reprise)
WHERE id = 'f1000000-0000-0000-0000-000000000006';

-- L'item de catalogue qui compose cette offre la suit, sans quoi la composition
-- serait rompue.
UPDATE catalog_items SET created_by_id = (SELECT chef_produit FROM reprise)
WHERE id = 'e1000000-0000-0000-0000-000000000014';

-- Le visuel rattache a « kite scolaire », offre entierement produite par les
-- comptes conserves. Le fichier avait ete televerse par le compte de demo.
UPDATE media_assets SET uploaded_by_id = (SELECT analyste FROM reprise)
WHERE id = 'b70ce25d-5a95-42d4-b133-b3d00f25ba49';

-- Perimetre des contenus a supprimer, fige apres les transferts.
CREATE TEMP TABLE demo_offers ON COMMIT DROP AS
SELECT id FROM offers WHERE created_by_id IN (SELECT id FROM demo_users);

CREATE TEMP TABLE demo_items ON COMMIT DROP AS
SELECT id FROM catalog_items WHERE created_by_id IN (SELECT id FROM demo_users);

CREATE TEMP TABLE demo_media ON COMMIT DROP AS
SELECT id FROM media_assets WHERE uploaded_by_id IN (SELECT id FROM demo_users);

-- ============================================================
-- 2. CONTENUS RATTACHES AUX OFFRES SUPPRIMEES
--    offer_items, offer_media, offer_versions, offer_status_history et ab_tests
--    partent en cascade avec l'offre. Les quatre references restantes sont en
--    NO ACTION et doivent etre levees a la main.
-- ============================================================
DELETE FROM notifications       WHERE related_offer_id IN (SELECT id FROM demo_offers);
DELETE FROM kpi_events          WHERE offer_id         IN (SELECT id FROM demo_offers);
DELETE FROM integration_exports WHERE offer_id         IN (SELECT id FROM demo_offers);
DELETE FROM campaigns           WHERE offer_id         IN (SELECT id FROM demo_offers)
                                   OR created_by_id    IN (SELECT id FROM demo_users);
DELETE FROM ab_tests            WHERE created_by_id    IN (SELECT id FROM demo_users);

DELETE FROM offers WHERE id IN (SELECT id FROM demo_offers);

-- ============================================================
-- 3. CATALOGUE
--    Les regles metier relient deux items entre eux : elles n'ont plus d'objet
--    des lors qu'une de leurs extremites disparait. catalog_items est une table
--    de base dont products, services et packs sont les specialisations : la
--    ligne fille doit partir avant la ligne mere.
-- ============================================================
DELETE FROM business_rules WHERE created_by_id  IN (SELECT id FROM demo_users)
                              OR source_item_id IN (SELECT id FROM demo_items)
                              OR target_item_id IN (SELECT id FROM demo_items);

DELETE FROM offer_items WHERE catalog_item_id IN (SELECT id FROM demo_items);
DELETE FROM pack_items  WHERE catalog_item_id IN (SELECT id FROM demo_items);

DELETE FROM products WHERE id IN (SELECT id FROM demo_items);
DELETE FROM services WHERE id IN (SELECT id FROM demo_items);
DELETE FROM packs    WHERE id IN (SELECT id FROM demo_items);

DELETE FROM catalog_items WHERE id IN (SELECT id FROM demo_items);

-- ============================================================
-- 4. MEDIATHEQUE
--    Les liens offer_media sont deja partis en cascade avec les offres ; les
--    validations partent en cascade avec le media.
-- ============================================================
DELETE FROM offer_media  WHERE media_asset_id IN (SELECT id FROM demo_media);
DELETE FROM media_assets WHERE id             IN (SELECT id FROM demo_media);

-- ============================================================
-- 5. DONNEES STRICTEMENT PERSONNELLES
--    Meme traitement qu'en V033 : sessions, cles de connexion, notifications et
--    journal d'activite sont attaches a une personne et disparaissent avec elle.
--    Les transferer reviendrait a attribuer a un tiers des actions qu'il n'a pas
--    faites.
-- ============================================================
DELETE FROM refresh_tokens       WHERE user_id      IN (SELECT id FROM demo_users);
DELETE FROM webauthn_credentials WHERE user_id      IN (SELECT id FROM demo_users);
DELETE FROM notifications        WHERE recipient_id IN (SELECT id FROM demo_users);
DELETE FROM audit_logs           WHERE user_id      IN (SELECT id FROM demo_users);
DELETE FROM kpi_events           WHERE actor_id     IN (SELECT id FROM demo_users);

-- ============================================================
-- 6. REFERENCES RESIDUELLES
--    Colonnes designant l'auteur d'un contenu qui, lui, reste en base. Elles
--    sont pour la plupart NOT NULL et doivent pointer un compte existant : le
--    compte administrateur les reprend, comme en V033. En pratique la plupart de
--    ces mises a jour ne touchent aucune ligne, les contenus concernes ayant
--    ete supprimes ci-dessus ; elles sont conservees comme filet de securite.
-- ============================================================
UPDATE offers               SET enriched_by_id  = (SELECT admin FROM reprise) WHERE enriched_by_id  IN (SELECT id FROM demo_users);
UPDATE offer_versions       SET changed_by_id   = (SELECT admin FROM reprise) WHERE changed_by_id   IN (SELECT id FROM demo_users);
UPDATE offer_status_history SET changed_by_id   = (SELECT admin FROM reprise) WHERE changed_by_id   IN (SELECT id FROM demo_users);
UPDATE media_validations    SET validated_by_id = (SELECT admin FROM reprise) WHERE validated_by_id IN (SELECT id FROM demo_users);
UPDATE duplicate_flags      SET resolved_by_id  = (SELECT admin FROM reprise) WHERE resolved_by_id  IN (SELECT id FROM demo_users);
UPDATE business_rules       SET created_by_id   = (SELECT admin FROM reprise) WHERE created_by_id   IN (SELECT id FROM demo_users);
UPDATE catalog_items        SET created_by_id   = (SELECT admin FROM reprise) WHERE created_by_id   IN (SELECT id FROM demo_users);
UPDATE media_assets         SET uploaded_by_id  = (SELECT admin FROM reprise) WHERE uploaded_by_id  IN (SELECT id FROM demo_users);
UPDATE campaigns            SET created_by_id   = (SELECT admin FROM reprise) WHERE created_by_id   IN (SELECT id FROM demo_users);
UPDATE ab_tests             SET created_by_id   = (SELECT admin FROM reprise) WHERE created_by_id   IN (SELECT id FROM demo_users);
UPDATE notification_configs SET updated_by_id   = (SELECT admin FROM reprise) WHERE updated_by_id   IN (SELECT id FROM demo_users);
UPDATE kpi_configs          SET updated_by_id   = (SELECT admin FROM reprise) WHERE updated_by_id   IN (SELECT id FROM demo_users);
UPDATE platform_settings    SET updated_by_id   = (SELECT admin FROM reprise) WHERE updated_by_id   IN (SELECT id FROM demo_users);

-- ============================================================
-- 7. SUPPRESSION DES COMPTES
-- ============================================================
DELETE FROM users WHERE id IN (SELECT id FROM demo_users);

-- ============================================================
-- 8. GARDE-FOU
--    Une reference oubliee aurait deja fait echouer la suppression ci-dessus sur
--    une violation de cle etrangere. Ce controle verifie les post-conditions
--    propres a cette migration : plus aucun compte de demonstration, et au moins
--    un administrateur pour que la plateforme reste administrable.
-- ============================================================
DO $$
DECLARE admin_count INT;
BEGIN
    IF EXISTS (SELECT 1 FROM users WHERE email IN (
        'chef.produit@moov-africa.bf', 'chef.service@moov-africa.bf',
        'chef.departement@moov-africa.bf', 'community.manager@moov-africa.bf',
        'analyste.marketing@moov-africa.bf', 'chef.produit2@moov-africa.bf')) THEN
        RAISE EXCEPTION 'V041 : un compte de demonstration est toujours present';
    END IF;

    SELECT count(*) INTO admin_count
    FROM users u JOIN roles r ON r.id = u.role_id
    WHERE r.name IN ('ADMIN_SYSTEME', 'SUPER_ADMIN');

    IF admin_count < 1 THEN
        RAISE EXCEPTION 'V041 : plus aucun administrateur, la plateforme serait inadministrable';
    END IF;
END $$;
