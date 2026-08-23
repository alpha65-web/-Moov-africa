-- Configuration de demonstration : notifications, indicateurs et alertes.
--
-- Les tables notification_configs et kpi_configs n'avaient jamais ete alimentees.
-- L'ecran Parametres presentait donc deux sections vides alors que les endpoints
-- /config/notifications et /config/kpi fonctionnaient correctement.
-- Les notifications sont par ailleurs adressees a tous les comptes administrateurs
-- et non au seul auteur du jeu de donnees, afin que l'ecran soit alimente quel que
-- soit le compte utilise.

-- ============================================================
-- 1. CONFIGURATION DES NOTIFICATIONS (un reglage par type et par canal)
-- ============================================================
INSERT INTO notification_configs (id, type, channel, enabled, updated_at) VALUES
  ('c1000000-0000-0000-0000-000000000001', 'ENRICHMENT_REQUIRED',   'IN_APP', true,  now()),
  ('c1000000-0000-0000-0000-000000000002', 'ENRICHMENT_REQUIRED',   'EMAIL',  true,  now()),
  ('c1000000-0000-0000-0000-000000000003', 'VALIDATION_REQUIRED',   'IN_APP', true,  now()),
  ('c1000000-0000-0000-0000-000000000004', 'VALIDATION_REQUIRED',   'EMAIL',  true,  now()),
  ('c1000000-0000-0000-0000-000000000005', 'STRATEGIC_VALIDATION',  'IN_APP', true,  now()),
  ('c1000000-0000-0000-0000-000000000006', 'STRATEGIC_VALIDATION',  'EMAIL',  false, now()),
  ('c1000000-0000-0000-0000-000000000007', 'OFFER_REJECTED',        'IN_APP', true,  now()),
  ('c1000000-0000-0000-0000-000000000008', 'OFFER_REJECTED',        'EMAIL',  true,  now()),
  ('c1000000-0000-0000-0000-000000000009', 'OFFER_PUBLISHED',       'IN_APP', true,  now()),
  ('c1000000-0000-0000-0000-000000000010', 'OFFER_PUBLISHED',       'EMAIL',  false, now()),
  ('c1000000-0000-0000-0000-000000000011', 'OFFER_EXPIRING',        'IN_APP', true,  now()),
  ('c1000000-0000-0000-0000-000000000012', 'OFFER_EXPIRING',        'EMAIL',  true,  now()),
  ('c1000000-0000-0000-0000-000000000013', 'CAMPAIGN_READY',        'IN_APP', true,  now()),
  ('c1000000-0000-0000-0000-000000000014', 'CAMPAIGN_READY',        'EMAIL',  false, now())
ON CONFLICT (id) DO NOTHING;

-- ============================================================
-- 2. INDICATEURS SUIVIS
--    Les codes correspondent aux event_type reellement emis dans kpi_events,
--    afin que l'ecran Analyses et l'ecran Parametres parlent des memes mesures.
-- ============================================================
INSERT INTO kpi_configs (id, kpi_code, label, enabled, threshold_expression, updated_at) VALUES
  ('c2000000-0000-0000-0000-000000000001', 'TIME_TO_MARKET',  'Delai de mise sur le marche',        true,  '<= 30 jours', now()),
  ('c2000000-0000-0000-0000-000000000002', 'OFFER_CREATED',   'Offres creees',                      true,  NULL,          now()),
  ('c2000000-0000-0000-0000-000000000003', 'OFFER_ENRICHED',  'Offres enrichies',                   true,  NULL,          now()),
  ('c2000000-0000-0000-0000-000000000004', 'OFFER_VALIDATED', 'Offres validees',                    true,  NULL,          now()),
  ('c2000000-0000-0000-0000-000000000005', 'OFFER_PUBLISHED', 'Offres publiees',                    true,  '>= 5 par mois', now()),
  ('c2000000-0000-0000-0000-000000000006', 'CAMPAIGN_SENT',   'Campagnes diffusees',                true,  NULL,          now()),
  ('c2000000-0000-0000-0000-000000000007', 'CATALOG_QUALITY', 'Score qualite du referentiel',       true,  '>= 80/100',   now()),
  ('c2000000-0000-0000-0000-000000000008', 'MEDIA_PENDING',   'Medias en attente de validation',    false, '<= 10',       now())
ON CONFLICT (kpi_code) DO NOTHING;

-- ============================================================
-- 3. NOTIFICATIONS POUR TOUS LES COMPTES ADMINISTRATEURS
--    Le jeu V024 ne les adressait qu'a alpha@moov-africa.bf.
-- ============================================================
INSERT INTO notifications (id, recipient_id, type, title, message, read, created_at)
SELECT
    md5(u.id::text || n.slot::text)::uuid,
    u.id,
    n.type,
    n.title,
    n.message,
    n.read,
    now() - (n.slot || ' hours')::interval
FROM users u
CROSS JOIN (VALUES
    (1,  'VALIDATION_REQUIRED', 'Offre en attente de validation',
         'L offre "Promo Data Rentree" attend votre decision de validation.', false),
    (6,  'ENRICHMENT_REQUIRED', 'Offre a enrichir',
         'L offre "Pack Business 15 Go" doit etre enrichie avant soumission.', false),
    (24, 'OFFER_EXPIRING',      'Offre bientot expiree',
         'L offre "Pass Week-end illimite" arrive a echeance dans 7 jours.', false),
    (48, 'OFFER_PUBLISHED',     'Offre publiee',
         'L offre "Promo Data Rentree" est desormais publiee sur tous les canaux.', true),
    (72, 'CAMPAIGN_READY',      'Campagne prete a diffuser',
         'La campagne "Rentree Moov" est prete et attend sa planification.', true)
) AS n(slot, type, title, message, read)
WHERE u.email IN ('admin@moov-africa.bf', 'watta@moov-africa.bf')
ON CONFLICT (id) DO NOTHING;
