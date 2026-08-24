-- Un compte par role metier, en plus du compte administrateur.
--
-- Les cinq roles de V014 (chef de produit, chef de service, chef de departement,
-- community manager, analyste marketing) n'avaient aucun titulaire : la plateforme
-- ne pouvait etre parcourue que depuis un compte administrateur, qui voit tout et
-- ne permet donc pas de verifier le cloisonnement des permissions.
--
-- force_password_change reste a false : contrairement aux comptes administrateurs,
-- ces comptes servent a parcourir l'application, et un changement de mot de passe
-- impose bloquerait tous les endpoints (403 FORCE_PASSWORD_CHANGE) avant d'avoir
-- pu afficher le moindre ecran. Aucun de ces roles n'est par ailleurs soumis a la
-- double authentification : MfaPolicyFilter ne l'exige que d'ADMIN_SYSTEME et
-- SUPER_ADMIN.
--
-- Mots de passe (hash BCrypt cost 12, alignes sur V022) :
--   chef.produit@moov-africa.bf       MoovProduit@2026!
--   chef.service@moov-africa.bf       MoovService@2026!
--   chef.departement@moov-africa.bf   MoovDepartement@2026!
--   community.manager@moov-africa.bf  MoovCommunity@2026!
--   analyste.marketing@moov-africa.bf MoovAnalyste@2026!
-- Tous respectent PasswordPolicyService : 12 caracteres minimum, majuscule,
-- minuscule, chiffre et caractere special.

INSERT INTO users (id, email, password_hash, first_name, last_name, role_id, status,
                   failed_login_attempts, force_password_change)
VALUES
  ('c0000000-0000-0000-0000-000000000011', 'chef.produit@moov-africa.bf',
   '$2b$12$SK7Y.pmbKVo7BtPrQPb/iOpVfARtNSr.rDQdw4mgey4LSdkemyrxy',
   'Chef', 'Produit',       'a0000000-0000-0000-0000-000000000002', 'ACTIVE', 0, false),

  ('c0000000-0000-0000-0000-000000000012', 'chef.service@moov-africa.bf',
   '$2b$12$atoXK9/z9fOBeO1y44oKOuHHnN.Q6AoJfSdJo0tJ2UqLq.R3S6fga',
   'Chef', 'Service',        'a0000000-0000-0000-0000-000000000004', 'ACTIVE', 0, false),

  ('c0000000-0000-0000-0000-000000000013', 'chef.departement@moov-africa.bf',
   '$2b$12$.Com8KyoMgY5vB3kJ/vfH.Ul7cfMg0nFh5AOKVrtWW7u7HS5SNNnS',
   'Chef', 'Département',    'a0000000-0000-0000-0000-000000000005', 'ACTIVE', 0, false),

  ('c0000000-0000-0000-0000-000000000014', 'community.manager@moov-africa.bf',
   '$2b$12$fRO.9VxUadCOOxeIStMW6Ot7pSyitXIpuix5O1IOBrrGlFLG0RE7y',
   'Community', 'Manager',   'a0000000-0000-0000-0000-000000000006', 'ACTIVE', 0, false),

  ('c0000000-0000-0000-0000-000000000015', 'analyste.marketing@moov-africa.bf',
   '$2b$12$0KBi3nRv5LTnOBHFg6NInuN4fRAR8fxNUOEnIlNeZ3vkwfKV2p2wO',
   'Analyste', 'Marketing',  'a0000000-0000-0000-0000-000000000003', 'ACTIVE', 0, false)
ON CONFLICT DO NOTHING;

-- Notifications adressees a chaque titulaire.
--
-- Sans elles, l'ecran Notifications est vide sur les cinq comptes : V024 et V028
-- n'alimentaient que les comptes administrateurs. Chaque notification pointe une
-- offre reelle du jeu V024 et correspond a une responsabilite du role :
-- l'analyste enrichit, le chef de service valide, le chef de departement publie,
-- le community manager diffuse.
INSERT INTO notifications (id, recipient_id, type, title, message, read, related_offer_id, created_at)
VALUES
  -- Chef de produit : cree et soumet les offres
  ('52000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000011',
   'ENRICHMENT_REQUIRED', 'Enrichissement requis : Moov Money Zero Frais',
   'Cette offre est incomplete : mentions legales et visuels manquants avant soumission.',
   false, 'f1000000-0000-0000-0000-000000000005', now() - interval '6 hours'),
  ('52000000-0000-0000-0000-000000000002', 'c0000000-0000-0000-0000-000000000011',
   'OFFER_PUBLISHED', 'Offre publiee : Promo Data 5 Go - Rentree',
   'L offre que vous avez creee est desormais publiee sur l ensemble des canaux.',
   true, 'f1000000-0000-0000-0000-000000000001', now() - interval '20 days'),

  -- Chef de service : valide au niveau operationnel
  ('52000000-0000-0000-0000-000000000003', 'c0000000-0000-0000-0000-000000000012',
   'VALIDATION_REQUIRED', 'Validation requise : Pass Weekend Illimite',
   'L offre Pass Weekend Illimite attend votre validation avant publication.',
   false, 'f1000000-0000-0000-0000-000000000004', now() - interval '2 days'),
  ('52000000-0000-0000-0000-000000000004', 'c0000000-0000-0000-0000-000000000012',
   'OFFER_PUBLISHED', 'Offre publiee : Pack Decouverte Nouveaux Clients',
   'L offre que vous aviez validee est publiee depuis le mois dernier.',
   true, 'f1000000-0000-0000-0000-000000000002', now() - interval '45 days'),

  -- Chef de departement : arbitre et publie
  ('52000000-0000-0000-0000-000000000005', 'c0000000-0000-0000-0000-000000000013',
   'STRATEGIC_VALIDATION', 'Arbitrage attendu : Offre Entreprise Data 15 Go',
   'L offre est validee au niveau operationnel et attend votre decision de publication.',
   false, 'f1000000-0000-0000-0000-000000000003', now() - interval '3 days'),
  ('52000000-0000-0000-0000-000000000006', 'c0000000-0000-0000-0000-000000000013',
   'OFFER_EXPIRING', 'Expiration proche : Promo Voix International',
   'Cette offre arrive a echeance dans 30 jours. Une reconduction est a arbitrer.',
   false, 'f1000000-0000-0000-0000-000000000007', now() - interval '5 hours'),

  -- Community manager : prepare et diffuse les campagnes
  ('52000000-0000-0000-0000-000000000007', 'c0000000-0000-0000-0000-000000000014',
   'CAMPAIGN_READY', 'Campagne a planifier : Teasing Pass Weekend',
   'La campagne Teasing Pass Weekend est en brouillon et attend sa planification.',
   false, 'f1000000-0000-0000-0000-000000000004', now() - interval '1 day'),
  ('52000000-0000-0000-0000-000000000008', 'c0000000-0000-0000-0000-000000000014',
   'OFFER_PUBLISHED', 'Offre publiee : Promo Data 5 Go - Rentree',
   'La campagne Rentree Moov peut etre diffusee : l offre associee est publiee.',
   true, 'f1000000-0000-0000-0000-000000000001', now() - interval '20 days'),

  -- Analyste marketing : enrichit les offres
  ('52000000-0000-0000-0000-000000000009', 'c0000000-0000-0000-0000-000000000015',
   'ENRICHMENT_REQUIRED', 'Enrichissement requis : Moov Money Zero Frais',
   'Descriptions longues, mentions legales et visuels restent a produire.',
   false, 'f1000000-0000-0000-0000-000000000005', now() - interval '1 day'),
  ('52000000-0000-0000-0000-000000000010', 'c0000000-0000-0000-0000-000000000015',
   'OFFER_EXPIRING', 'Expiration proche : Promo Voix International',
   'Les contenus de cette offre devront etre repris si elle est reconduite.',
   false, 'f1000000-0000-0000-0000-000000000007', now() - interval '5 hours')
ON CONFLICT DO NOTHING;
