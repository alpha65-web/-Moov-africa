-- Second chef de produit : le septieme des comptes que portaient les migrations.
--
-- V041 recensait sept comptes poses par les migrations avant leur retrait :
-- alpha@ pour l'administration (V022), les cinq roles metier (V032), et ce
-- second chef de produit (V036). V051 a repose les six premiers ; celui-ci
-- completait la serie et manquait encore.
--
-- Il n'est pas un doublon du premier. Le cahier des charges impose qu'« un chef
-- de produit ne voit que les offres qu'il a lui-meme creees, jamais celles des
-- autres chefs de produit », et que le chef de service ait, lui, une vue
-- transversale. Avec un seul titulaire du role, la regle s'applique sans se
-- voir : il faut deux comptes distincts pour la mettre a l'epreuve a l'ecran.
--
-- Identifiant et UUID sont ceux de V036. Mot de passe : MoovProduit2@2026!
-- (hash BCrypt cout 12, comme V032 et V051).
--
-- Les deux offres que V036 lui attachait ne sont pas recreees : V041 les a
-- retirees a dessein, et rien ne doit s'afficher qui n'ait ete produit par un
-- usage reel. Pour montrer le cloisonnement, il suffit que chaque chef de
-- produit cree une offre depuis l'interface.

INSERT INTO users (id, email, password_hash, first_name, last_name, role_id, status,
                   failed_login_attempts, force_password_change)
VALUES ('c0000000-0000-0000-0000-000000000016', 'chef.produit2@moov-africa.bf',
        '$2b$12$bBc2v7HmK4FkHWclxgC0MOJ7Uw22GmqC.z1Q4amceVrzruhBegTM6',
        'Chef', 'Produit 2',
        (SELECT id FROM roles WHERE name = 'CHEF_PRODUIT'), 'ACTIVE', 0, false)
ON CONFLICT DO NOTHING;

-- ============================================================
-- GARDE-FOU
--    Deux titulaires actifs du role sont necessaires pour que le cloisonnement
--    entre chefs de produit soit verifiable. En dessous, la regle reste appliquee
--    par le serveur mais ne peut plus etre montree, et mieux vaut le savoir au
--    demarrage qu'au moment de la demonstration.
-- ============================================================
DO $$
DECLARE titulaires INT;
BEGIN
    SELECT count(*) INTO titulaires
    FROM users u JOIN roles r ON r.id = u.role_id
    WHERE r.name = 'CHEF_PRODUIT' AND u.status = 'ACTIVE';

    IF titulaires < 2 THEN
        RAISE EXCEPTION 'V052 : % titulaire(s) actif(s) du role CHEF_PRODUIT, il en faut deux', titulaires;
    END IF;
END $$;
