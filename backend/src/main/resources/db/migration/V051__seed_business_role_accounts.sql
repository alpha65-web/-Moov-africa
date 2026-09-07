-- Un titulaire par role metier, sur toute base reconstruite a zero.
--
-- V041 avait retire les comptes de demonstration pour ne conserver que ceux
-- reellement crees par l'equipe. Elle notait elle-meme la consequence : les deux
-- comptes conserves « n'existent que dans la base ou ils ont ete crees ; sur une
-- base reconstruite a zero, ils sont absents ». Un depot fraichement clone ne
-- proposait donc qu'un seul compte, l'administrateur alpha@, et les cinq roles
-- metier n'avaient plus aucun titulaire : le cloisonnement des permissions, qui
-- est le coeur du systeme, devenait indemontrable sans creer les comptes a la
-- main un par un.
--
-- Les cinq comptes sont donc reposes ici. Ce ne sont pas des donnees de vitrine :
-- ce sont des identifiants de connexion reels, qui ouvrent chacun l'interface de
-- son role. Le jeu de contenus que V032 leur avait attache — offres, elements de
-- catalogue, notifications — n'est en revanche pas recree : V041 l'a retire a
-- dessein, et une plateforme ne doit rien afficher qui n'ait ete produit par un
-- usage reel.
--
-- Identifiants et UUID sont ceux de V032, pour qu'une base deja migree a l'epoque
-- retrouve exactement ses comptes d'origine.
--
-- Mots de passe (hash BCrypt cout 12) :
--   chef.produit@moov-africa.bf       MoovProduit@2026!
--   chef.service@moov-africa.bf       MoovService@2026!
--   chef.departement@moov-africa.bf   MoovDepartement@2026!
--   community.manager@moov-africa.bf  MoovCommunity@2026!
--   analyste.marketing@moov-africa.bf MoovAnalyste@2026!
-- Tous respectent PasswordPolicyService : douze caracteres au minimum, une
-- majuscule, une minuscule, un chiffre et un caractere special.
--
-- force_password_change reste a false, pour la meme raison qu'en V032 : un
-- changement de mot de passe impose repondrait 403 FORCE_PASSWORD_CHANGE sur
-- tous les endpoints avant d'avoir pu afficher le moindre ecran. Aucun de ces
-- roles n'est par ailleurs soumis a la double authentification, que
-- MfaPolicyFilter n'exige que d'ADMIN_SYSTEME et de SUPER_ADMIN.
--
-- Le role est resolu par son nom et non par son identifiant : c'est le nom que
-- porte l'enumeration RoleName cote applicatif, et il ne bouge pas.

INSERT INTO users (id, email, password_hash, first_name, last_name, role_id, status,
                   failed_login_attempts, force_password_change)
VALUES
  ('c0000000-0000-0000-0000-000000000011', 'chef.produit@moov-africa.bf',
   '$2b$12$SK7Y.pmbKVo7BtPrQPb/iOpVfARtNSr.rDQdw4mgey4LSdkemyrxy',
   'Chef', 'Produit',
   (SELECT id FROM roles WHERE name = 'CHEF_PRODUIT'),       'ACTIVE', 0, false),

  ('c0000000-0000-0000-0000-000000000012', 'chef.service@moov-africa.bf',
   '$2b$12$atoXK9/z9fOBeO1y44oKOuHHnN.Q6AoJfSdJo0tJ2UqLq.R3S6fga',
   'Chef', 'Service',
   (SELECT id FROM roles WHERE name = 'CHEF_SERVICE'),       'ACTIVE', 0, false),

  ('c0000000-0000-0000-0000-000000000013', 'chef.departement@moov-africa.bf',
   '$2b$12$.Com8KyoMgY5vB3kJ/vfH.Ul7cfMg0nFh5AOKVrtWW7u7HS5SNNnS',
   'Chef', 'Département',
   (SELECT id FROM roles WHERE name = 'CHEF_DEPARTEMENT'),   'ACTIVE', 0, false),

  ('c0000000-0000-0000-0000-000000000014', 'community.manager@moov-africa.bf',
   '$2b$12$fRO.9VxUadCOOxeIStMW6Ot7pSyitXIpuix5O1IOBrrGlFLG0RE7y',
   'Community', 'Manager',
   (SELECT id FROM roles WHERE name = 'COMMUNITY_MANAGER'),  'ACTIVE', 0, false),

  ('c0000000-0000-0000-0000-000000000015', 'analyste.marketing@moov-africa.bf',
   '$2b$12$0KBi3nRv5LTnOBHFg6NInuN4fRAR8fxNUOEnIlNeZ3vkwfKV2p2wO',
   'Analyste', 'Marketing',
   (SELECT id FROM roles WHERE name = 'ANALYSTE_MARKETING'), 'ACTIVE', 0, false)
ON CONFLICT DO NOTHING;

-- ============================================================
-- GARDE-FOU
--    La migration doit laisser un titulaire actif pour chacun des cinq roles.
--    Un role sans titulaire signalerait soit un nom d'enumeration qui a change,
--    soit un compte reste inactif : dans les deux cas l'ecran correspondant
--    serait inatteignable, et mieux vaut que le demarrage s'arrete ici plutot
--    que de le decouvrir devant un jury.
-- ============================================================
DO $$
DECLARE orphelin TEXT;
BEGIN
    SELECT string_agg(r.name, ', ') INTO orphelin
    FROM (VALUES ('CHEF_PRODUIT'), ('CHEF_SERVICE'), ('CHEF_DEPARTEMENT'),
                 ('COMMUNITY_MANAGER'), ('ANALYSTE_MARKETING')) AS r(name)
    WHERE NOT EXISTS (
        SELECT 1 FROM users u JOIN roles ro ON ro.id = u.role_id
        WHERE ro.name = r.name AND u.status = 'ACTIVE');

    IF orphelin IS NOT NULL THEN
        RAISE EXCEPTION 'V051 : aucun compte actif pour le ou les roles %', orphelin;
    END IF;
END $$;
