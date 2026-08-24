-- Un seul compte administrateur : alpha@moov-africa.bf.
--
-- Trois comptes portaient le role ADMIN_SYSTEME : admin@moov-africa.bf (V015,
-- mot de passe repose en V031), alpha@moov-africa.bf et watta@moov-africa.bf
-- (V022). Trois administrateurs sur une plateforme qui en demande un seul
-- brouillent la demonstration du cloisonnement des roles et multiplient les
-- comptes a proteger. Les deux comptes surnumeraires sont supprimes.
--
-- La suppression ne peut pas etre directe : dix-huit colonnes referencent
-- users(id), dont plusieurs NOT NULL. Chaque reference est traitee explicitement
-- ci-dessous, selon sa nature.

-- ============================================================
-- 1. DONNEES STRICTEMENT PERSONNELLES : supprimees
--    Sessions, cles de connexion, notifications et journal d'activite sont
--    attaches a une personne. Les transferer sur alpha@ reviendrait soit a lui
--    ouvrir les sessions d'un autre compte, soit a lui attribuer des actions
--    qu'il n'a pas faites. Ils disparaissent avec leur titulaire.
-- ============================================================
DELETE FROM refresh_tokens
WHERE user_id IN (SELECT id FROM users WHERE email IN ('admin@moov-africa.bf', 'watta@moov-africa.bf'));

DELETE FROM webauthn_credentials
WHERE user_id IN (SELECT id FROM users WHERE email IN ('admin@moov-africa.bf', 'watta@moov-africa.bf'));

DELETE FROM notifications
WHERE recipient_id IN (SELECT id FROM users WHERE email IN ('admin@moov-africa.bf', 'watta@moov-africa.bf'));

DELETE FROM audit_logs
WHERE user_id IN (SELECT id FROM users WHERE email IN ('admin@moov-africa.bf', 'watta@moov-africa.bf'));

DELETE FROM kpi_events
WHERE actor_id IN (SELECT id FROM users WHERE email IN ('admin@moov-africa.bf', 'watta@moov-africa.bf'));

-- ============================================================
-- 2. ENRICHISSEMENT DES OFFRES : transfere a l'analyste marketing
--    V024 designait watta@ comme enrichisseur de cinq offres. C'est le role
--    ANALYSTE_MARKETING qui porte la permission OFFER_ENRICH : le compte cree
--    en V032 reprend ces enrichissements, ce qui rend le jeu de demonstration
--    coherent avec la matrice des permissions.
-- ============================================================
UPDATE offers SET enriched_by_id = 'c0000000-0000-0000-0000-000000000015'
WHERE enriched_by_id IN (SELECT id FROM users WHERE email IN ('admin@moov-africa.bf', 'watta@moov-africa.bf'));

-- ============================================================
-- 3. PATERNITE DES CONTENUS : transferee a alpha@moov-africa.bf
--    Ces colonnes designent le compte a l'origine d'un contenu qui, lui, reste
--    en base. Elles sont pour la plupart NOT NULL : elles doivent pointer un
--    compte existant. Le seul administrateur survivant les reprend.
-- ============================================================
UPDATE catalog_items         SET created_by_id   = 'c0000000-0000-0000-0000-000000000002' WHERE created_by_id   IN (SELECT id FROM users WHERE email IN ('admin@moov-africa.bf', 'watta@moov-africa.bf'));
UPDATE duplicate_flags       SET resolved_by_id  = 'c0000000-0000-0000-0000-000000000002' WHERE resolved_by_id  IN (SELECT id FROM users WHERE email IN ('admin@moov-africa.bf', 'watta@moov-africa.bf'));
UPDATE business_rules        SET created_by_id   = 'c0000000-0000-0000-0000-000000000002' WHERE created_by_id   IN (SELECT id FROM users WHERE email IN ('admin@moov-africa.bf', 'watta@moov-africa.bf'));
UPDATE offers                SET created_by_id   = 'c0000000-0000-0000-0000-000000000002' WHERE created_by_id   IN (SELECT id FROM users WHERE email IN ('admin@moov-africa.bf', 'watta@moov-africa.bf'));
UPDATE offer_versions        SET changed_by_id   = 'c0000000-0000-0000-0000-000000000002' WHERE changed_by_id   IN (SELECT id FROM users WHERE email IN ('admin@moov-africa.bf', 'watta@moov-africa.bf'));
UPDATE offer_status_history  SET changed_by_id   = 'c0000000-0000-0000-0000-000000000002' WHERE changed_by_id   IN (SELECT id FROM users WHERE email IN ('admin@moov-africa.bf', 'watta@moov-africa.bf'));
UPDATE media_assets          SET uploaded_by_id  = 'c0000000-0000-0000-0000-000000000002' WHERE uploaded_by_id  IN (SELECT id FROM users WHERE email IN ('admin@moov-africa.bf', 'watta@moov-africa.bf'));
UPDATE media_validations     SET validated_by_id = 'c0000000-0000-0000-0000-000000000002' WHERE validated_by_id IN (SELECT id FROM users WHERE email IN ('admin@moov-africa.bf', 'watta@moov-africa.bf'));
UPDATE ab_tests              SET created_by_id   = 'c0000000-0000-0000-0000-000000000002' WHERE created_by_id   IN (SELECT id FROM users WHERE email IN ('admin@moov-africa.bf', 'watta@moov-africa.bf'));
UPDATE campaigns             SET created_by_id   = 'c0000000-0000-0000-0000-000000000002' WHERE created_by_id   IN (SELECT id FROM users WHERE email IN ('admin@moov-africa.bf', 'watta@moov-africa.bf'));
UPDATE notification_configs  SET updated_by_id   = 'c0000000-0000-0000-0000-000000000002' WHERE updated_by_id   IN (SELECT id FROM users WHERE email IN ('admin@moov-africa.bf', 'watta@moov-africa.bf'));
UPDATE kpi_configs           SET updated_by_id   = 'c0000000-0000-0000-0000-000000000002' WHERE updated_by_id   IN (SELECT id FROM users WHERE email IN ('admin@moov-africa.bf', 'watta@moov-africa.bf'));
UPDATE platform_settings     SET updated_by_id   = 'c0000000-0000-0000-0000-000000000002' WHERE updated_by_id   IN (SELECT id FROM users WHERE email IN ('admin@moov-africa.bf', 'watta@moov-africa.bf'));

-- ============================================================
-- 4. SUPPRESSION DES DEUX COMPTES
-- ============================================================
DELETE FROM users WHERE email IN ('admin@moov-africa.bf', 'watta@moov-africa.bf');

-- ============================================================
-- 5. GARDE-FOU
--    Si une reference avait ete oubliee, la suppression ci-dessus aurait leve une
--    violation de cle etrangere et la migration aurait echoue d'elle-meme. Ce
--    controle verifie la post-condition propre a cette migration : les deux
--    comptes ont bien disparu. Le nombre d'administrateurs restants est seulement
--    signale, car un compte cree depuis l'interface ne doit pas bloquer le
--    demarrage de l'application.
-- ============================================================
DO $$
DECLARE admin_count INT;
BEGIN
    IF EXISTS (SELECT 1 FROM users WHERE email IN ('admin@moov-africa.bf', 'watta@moov-africa.bf')) THEN
        RAISE EXCEPTION 'V033 : admin@moov-africa.bf ou watta@moov-africa.bf est toujours present';
    END IF;

    SELECT count(*) INTO admin_count
    FROM users u JOIN roles r ON r.id = u.role_id
    WHERE r.name IN ('ADMIN_SYSTEME', 'SUPER_ADMIN');

    IF admin_count <> 1 THEN
        RAISE WARNING 'V033 : % compte(s) administrateur restant(s) au lieu d''un seul. Les comptes crees depuis l''interface sont a supprimer depuis l''ecran Utilisateurs.', admin_count;
    END IF;
END $$;
