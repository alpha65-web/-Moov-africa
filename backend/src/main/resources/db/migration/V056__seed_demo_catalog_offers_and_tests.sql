-- Jeu de donnees de demonstration : catalogue, regles, offres a chaque etape du
-- circuit, tests A/B, campagnes et traces de diffusion.
--
-- Il sert de base d'essai : chaque role trouve en se connectant des fiches sur
-- lesquelles agir. Les auteurs sont les comptes metier de demonstration (V051 et
-- V052), pas les comptes reels. Toutes les insertions sont idempotentes et
-- portent des identifiants fixes prefixes « a5 », ce qui permet de les retrouver
-- et de les retirer d'un bloc.
--
-- Les dates sont relatives au moment de la migration : le Time To Market et les
-- durees par etape se calculent sur des ecarts realistes (quelques jours par
-- etape) et non sur des dates figees.
--
-- Les medias ne sont pas semes : ils exigent des fichiers reellement presents dans
-- le stockage, sans quoi leur affichage echouerait.

-- Comptes (V051, V052)
--   chef.produit       c0000000-0000-0000-0000-000000000011
--   chef.service       c0000000-0000-0000-0000-000000000012
--   chef.departement   c0000000-0000-0000-0000-000000000013
--   community.manager  c0000000-0000-0000-0000-000000000014
--   analyste.marketing c0000000-0000-0000-0000-000000000015
--   chef.produit2      c0000000-0000-0000-0000-000000000016

-- ============================================================
-- 1. PRODUITS (10)
-- ============================================================
INSERT INTO catalog_items (id, item_type, name, description, status, base_price, currency, category_id, created_by_id, version, created_at, updated_at) VALUES
  ('a5100000-0000-0000-0000-000000000001', 'PRODUCT', 'Smartphone Moov X2',        'Smartphone 4G 6,5 pouces, 64 Go, double SIM, batterie 5000 mAh.',                 'ACTIVE', 45000,  'XOF', 'd2000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000011', 0, now() - interval '60 days', now() - interval '60 days'),
  ('a5100000-0000-0000-0000-000000000002', 'PRODUCT', 'Smartphone Moov X2 Pro',    'Smartphone 5G 6,7 pouces AMOLED, 128 Go, triple caméra 50 Mpx.',                  'ACTIVE', 89000,  'XOF', 'd2000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000011', 0, now() - interval '58 days', now() - interval '58 days'),
  ('a5100000-0000-0000-0000-000000000003', 'PRODUCT', 'Téléphone Moov Classic',    'Téléphone à touches 2G/4G, autonomie 10 jours, radio FM et lampe torche.',        'ACTIVE', 9500,   'XOF', 'd2000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000011', 0, now() - interval '57 days', now() - interval '57 days'),
  ('a5100000-0000-0000-0000-000000000004', 'PRODUCT', 'Routeur 4G+ Domicile',      'Routeur 4G+ Wi-Fi 5, jusqu''à 32 appareils connectés, 4 ports Ethernet.',         'ACTIVE', 39000,  'XOF', 'd2000000-0000-0000-0000-000000000003', 'c0000000-0000-0000-0000-000000000011', 0, now() - interval '55 days', now() - interval '55 days'),
  ('a5100000-0000-0000-0000-000000000005', 'PRODUCT', 'Routeur 5G Pro',            'Routeur 5G Wi-Fi 6 pour les débits très élevés, 64 appareils connectés.',          'ACTIVE', 95000,  'XOF', 'd2000000-0000-0000-0000-000000000003', 'c0000000-0000-0000-0000-000000000011', 0, now() - interval '54 days', now() - interval '54 days'),
  ('a5100000-0000-0000-0000-000000000006', 'PRODUCT', 'Clé 4G+ USB',               'Clé Internet USB 4G+ pour ordinateur, débit jusqu''à 300 Mbit/s.',                  'ACTIVE', 15000,  'XOF', 'd2000000-0000-0000-0000-000000000004', 'c0000000-0000-0000-0000-000000000011', 0, now() - interval '52 days', now() - interval '52 days'),
  ('a5100000-0000-0000-0000-000000000007', 'PRODUCT', 'Carte SIM 5G',              'Carte SIM triple découpe compatible 5G, avec crédit de bienvenue.',                 'ACTIVE', 500,    'XOF', 'd1000000-0000-0000-0000-000000000005', 'c0000000-0000-0000-0000-000000000011', 0, now() - interval '50 days', now() - interval '50 days'),
  ('a5100000-0000-0000-0000-000000000008', 'PRODUCT', 'Box Fibre FTTH',            'Box fibre optique Wi-Fi 6 avec téléphonie fixe incluse.',                            'ACTIVE', 65000,  'XOF', 'd2000000-0000-0000-0000-000000000003', 'c0000000-0000-0000-0000-000000000016', 0, now() - interval '48 days', now() - interval '48 days'),
  ('a5100000-0000-0000-0000-000000000009', 'PRODUCT', 'Tablette Moov Tab 10',      'Tablette 10 pouces 4G, 64 Go, idéale pour la famille et les études.',                'ACTIVE', 120000, 'XOF', 'd2000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000016', 0, now() - interval '46 days', now() - interval '46 days'),
  ('a5100000-0000-0000-0000-000000000010', 'PRODUCT', 'Modem 4G MiFi',             'Modem de poche 4G, batterie 8 heures, 10 appareils connectés.',                     'ACTIVE', 28000,  'XOF', 'd2000000-0000-0000-0000-000000000004', 'c0000000-0000-0000-0000-000000000016', 0, now() - interval '45 days', now() - interval '45 days')
ON CONFLICT (id) DO NOTHING;

INSERT INTO products (id, characteristics, pack_only) VALUES
  ('a5100000-0000-0000-0000-000000000001', '{"ecran": "6,5 pouces", "stockage": "64 Go", "reseau": "4G", "batterie": "5000 mAh"}'::jsonb, false),
  ('a5100000-0000-0000-0000-000000000002', '{"ecran": "6,7 pouces AMOLED", "stockage": "128 Go", "reseau": "5G", "camera": "50 Mpx"}'::jsonb, false),
  ('a5100000-0000-0000-0000-000000000003', '{"type": "touches", "reseau": "2G/4G", "autonomie": "10 jours"}'::jsonb, false),
  ('a5100000-0000-0000-0000-000000000004', '{"wifi": "Wi-Fi 5", "appareils": 32, "ethernet": 4}'::jsonb, false),
  ('a5100000-0000-0000-0000-000000000005', '{"wifi": "Wi-Fi 6", "appareils": 64, "reseau": "5G"}'::jsonb, false),
  ('a5100000-0000-0000-0000-000000000006', '{"interface": "USB 3.0", "debit_max": "300 Mbit/s"}'::jsonb, false),
  ('a5100000-0000-0000-0000-000000000007', '{"format": "triple découpe", "reseau": "5G"}'::jsonb, false),
  ('a5100000-0000-0000-0000-000000000008', '{"wifi": "Wi-Fi 6", "telephonie": "incluse", "ports": 4}'::jsonb, false),
  ('a5100000-0000-0000-0000-000000000009', '{"ecran": "10 pouces", "stockage": "64 Go", "reseau": "4G"}'::jsonb, false),
  ('a5100000-0000-0000-0000-000000000010', '{"batterie": "8 heures", "appareils": 10, "reseau": "4G"}'::jsonb, false)
ON CONFLICT (id) DO NOTHING;

-- ============================================================
-- 2. SERVICES (8)
-- ============================================================
INSERT INTO catalog_items (id, item_type, name, description, status, base_price, currency, category_id, created_by_id, version, created_at, updated_at) VALUES
  ('a5200000-0000-0000-0000-000000000001', 'SERVICE', 'Forfait Data 10 Go',            '10 Go d''Internet mobile valables 30 jours sur le réseau 4G/5G.',                         'ACTIVE', 5000,  'XOF', 'd2000000-0000-0000-0000-000000000027', 'c0000000-0000-0000-0000-000000000011', 0, now() - interval '56 days', now() - interval '56 days'),
  ('a5200000-0000-0000-0000-000000000002', 'SERVICE', 'Forfait Voix 200 min',          '200 minutes d''appels vers tous les réseaux nationaux, valables 30 jours.',              'ACTIVE', 3500,  'XOF', 'd2000000-0000-0000-0000-000000000027', 'c0000000-0000-0000-0000-000000000011', 0, now() - interval '56 days', now() - interval '56 days'),
  ('a5200000-0000-0000-0000-000000000003', 'SERVICE', 'Roaming Afrique 1 Go',          '1 Go d''Internet utilisable dans 12 pays d''Afrique de l''Ouest, valable 7 jours.',      'ACTIVE', 6000,  'XOF', 'd2000000-0000-0000-0000-000000000028', 'c0000000-0000-0000-0000-000000000011', 0, now() - interval '53 days', now() - interval '53 days'),
  ('a5200000-0000-0000-0000-000000000004', 'SERVICE', 'Moov Money Transfert national', 'Envoi d''argent vers tout numéro Moov Money du Burkina Faso.',                            'ACTIVE', 0,     'XOF', 'd2000000-0000-0000-0000-000000000023', 'c0000000-0000-0000-0000-000000000011', 0, now() - interval '51 days', now() - interval '51 days'),
  ('a5200000-0000-0000-0000-000000000005', 'SERVICE', 'Moov Money Paiement marchand',  'Paiement chez les commerçants partenaires par code marchand ou QR code.',                 'ACTIVE', 0,     'XOF', 'd2000000-0000-0000-0000-000000000024', 'c0000000-0000-0000-0000-000000000011', 0, now() - interval '51 days', now() - interval '51 days'),
  ('a5200000-0000-0000-0000-000000000006', 'SERVICE', 'Abonnement Fibre 50 Mbit/s',    'Accès Internet fibre optique 50 Mbit/s symétrique, sans limite de volume.',                'ACTIVE', 25000, 'XOF', 'd2000000-0000-0000-0000-000000000026', 'c0000000-0000-0000-0000-000000000011', 0, now() - interval '49 days', now() - interval '49 days'),
  ('a5200000-0000-0000-0000-000000000007', 'SERVICE', 'Pass Data Nuit 2 Go',           '2 Go utilisables de 23 h à 6 h, valables une nuit.',                                        'ACTIVE', 500,   'XOF', 'd2000000-0000-0000-0000-000000000027', 'c0000000-0000-0000-0000-000000000016', 0, now() - interval '44 days', now() - interval '44 days'),
  ('a5200000-0000-0000-0000-000000000008', 'SERVICE', 'Flotte Entreprise 10 lignes',   'Abonnement de 10 lignes professionnelles avec appels illimités entre les lignes.',         'ACTIVE', 45000, 'XOF', 'd2000000-0000-0000-0000-000000000029', 'c0000000-0000-0000-0000-000000000016', 0, now() - interval '43 days', now() - interval '43 days')
ON CONFLICT (id) DO NOTHING;

INSERT INTO services (id, service_type, characteristics, pack_only, billing_cycle) VALUES
  ('a5200000-0000-0000-0000-000000000001', 'DATA',         '{"volume": "10 Go", "validite": "30 jours", "reseau": "4G/5G"}'::jsonb, false, 'MONTHLY'),
  ('a5200000-0000-0000-0000-000000000002', 'VOICE',        '{"minutes": 200, "portee": "national", "validite": "30 jours"}'::jsonb, false, 'MONTHLY'),
  ('a5200000-0000-0000-0000-000000000003', 'DATA',         '{"volume": "1 Go", "pays": 12, "validite": "7 jours"}'::jsonb, false, 'WEEKLY'),
  ('a5200000-0000-0000-0000-000000000004', 'MOBILE_MONEY', '{"plafond_journalier": "2000000 XOF"}'::jsonb, false, 'ONE_TIME'),
  ('a5200000-0000-0000-0000-000000000005', 'MOBILE_MONEY', '{"commission": "0 %", "mode": "code marchand, QR"}'::jsonb, false, 'ONE_TIME'),
  ('a5200000-0000-0000-0000-000000000006', 'DATA',         '{"debit": "50 Mbit/s", "technologie": "FTTH", "volume": "illimité"}'::jsonb, false, 'MONTHLY'),
  ('a5200000-0000-0000-0000-000000000007', 'DATA',         '{"volume": "2 Go", "plage": "23h-6h"}'::jsonb, false, 'DAILY'),
  -- Vendable uniquement en pack : exerce la regle PACK_ONLY a l assemblage.
  ('a5200000-0000-0000-0000-000000000008', 'VOICE',        '{"lignes": 10, "appels_internes": "illimités"}'::jsonb, true, 'MONTHLY')
ON CONFLICT (id) DO NOTHING;

-- ============================================================
-- 3. PACKS (8)
-- ============================================================
INSERT INTO catalog_items (id, item_type, name, description, status, base_price, currency, category_id, created_by_id, version, created_at, updated_at) VALUES
  ('a5300000-0000-0000-0000-000000000001', 'PACK', 'Pack Connecté',              'Smartphone Moov X2 + Forfait Data 10 Go.',                          'ACTIVE', 48000,  'XOF', 'd1000000-0000-0000-0000-000000000004', 'c0000000-0000-0000-0000-000000000011', 0, now() - interval '47 days', now() - interval '47 days'),
  ('a5300000-0000-0000-0000-000000000002', 'PACK', 'Pack Maison 4G+',            'Routeur 4G+ Domicile + Forfait Data 10 Go.',                        'ACTIVE', 42000,  'XOF', 'd1000000-0000-0000-0000-000000000004', 'c0000000-0000-0000-0000-000000000011', 0, now() - interval '47 days', now() - interval '47 days'),
  ('a5300000-0000-0000-0000-000000000003', 'PACK', 'Pack Fibre Famille',         'Routeur 5G Pro + Abonnement Fibre 50 Mbit/s.',                      'ACTIVE', 110000, 'XOF', 'd1000000-0000-0000-0000-000000000004', 'c0000000-0000-0000-0000-000000000011', 0, now() - interval '46 days', now() - interval '46 days'),
  ('a5300000-0000-0000-0000-000000000004', 'PACK', 'Pack Étudiant',              'Téléphone Moov Classic + Forfait Data 10 Go + Forfait Voix 200 min.', 'ACTIVE', 16000,  'XOF', 'd1000000-0000-0000-0000-000000000004', 'c0000000-0000-0000-0000-000000000011', 0, now() - interval '45 days', now() - interval '45 days'),
  ('a5300000-0000-0000-0000-000000000005', 'PACK', 'Pack Voyageur',              'Carte SIM 5G + Roaming Afrique 1 Go.',                              'ACTIVE', 6000,   'XOF', 'd1000000-0000-0000-0000-000000000004', 'c0000000-0000-0000-0000-000000000011', 0, now() - interval '44 days', now() - interval '44 days'),
  ('a5300000-0000-0000-0000-000000000006', 'PACK', 'Pack Nomade',                'Modem 4G MiFi + Pass Data Nuit 2 Go.',                              'ACTIVE', 28000,  'XOF', 'd1000000-0000-0000-0000-000000000004', 'c0000000-0000-0000-0000-000000000016', 0, now() - interval '42 days', now() - interval '42 days'),
  ('a5300000-0000-0000-0000-000000000007', 'PACK', 'Pack Tablette Famille',      'Tablette Moov Tab 10 + Pass Data Nuit 2 Go.',                       'ACTIVE', 118000, 'XOF', 'd1000000-0000-0000-0000-000000000004', 'c0000000-0000-0000-0000-000000000016', 0, now() - interval '41 days', now() - interval '41 days'),
  ('a5300000-0000-0000-0000-000000000008', 'PACK', 'Pack Entreprise Connectée',  'Box Fibre FTTH + Flotte Entreprise 10 lignes.',                     'ACTIVE', 105000, 'XOF', 'd1000000-0000-0000-0000-000000000004', 'c0000000-0000-0000-0000-000000000016', 0, now() - interval '40 days', now() - interval '40 days')
ON CONFLICT (id) DO NOTHING;

INSERT INTO packs (id, bundle_price, bundle_discount) VALUES
  ('a5300000-0000-0000-0000-000000000001', 48000,  2000),
  ('a5300000-0000-0000-0000-000000000002', 42000,  2000),
  ('a5300000-0000-0000-0000-000000000003', 110000, 10000),
  ('a5300000-0000-0000-0000-000000000004', 16000,  2000),
  ('a5300000-0000-0000-0000-000000000005', 6000,   500),
  ('a5300000-0000-0000-0000-000000000006', 28000,  500),
  ('a5300000-0000-0000-0000-000000000007', 118000, 2500),
  ('a5300000-0000-0000-0000-000000000008', 105000, 5000)
ON CONFLICT (id) DO NOTHING;

INSERT INTO pack_items (id, pack_id, catalog_item_id, quantity) VALUES
  ('a5310000-0000-0000-0000-000000000001', 'a5300000-0000-0000-0000-000000000001', 'a5100000-0000-0000-0000-000000000001', 1),
  ('a5310000-0000-0000-0000-000000000002', 'a5300000-0000-0000-0000-000000000001', 'a5200000-0000-0000-0000-000000000001', 1),
  ('a5310000-0000-0000-0000-000000000003', 'a5300000-0000-0000-0000-000000000002', 'a5100000-0000-0000-0000-000000000004', 1),
  ('a5310000-0000-0000-0000-000000000004', 'a5300000-0000-0000-0000-000000000002', 'a5200000-0000-0000-0000-000000000001', 1),
  ('a5310000-0000-0000-0000-000000000005', 'a5300000-0000-0000-0000-000000000003', 'a5100000-0000-0000-0000-000000000005', 1),
  ('a5310000-0000-0000-0000-000000000006', 'a5300000-0000-0000-0000-000000000003', 'a5200000-0000-0000-0000-000000000006', 1),
  ('a5310000-0000-0000-0000-000000000007', 'a5300000-0000-0000-0000-000000000004', 'a5100000-0000-0000-0000-000000000003', 1),
  ('a5310000-0000-0000-0000-000000000008', 'a5300000-0000-0000-0000-000000000004', 'a5200000-0000-0000-0000-000000000001', 1),
  ('a5310000-0000-0000-0000-000000000009', 'a5300000-0000-0000-0000-000000000004', 'a5200000-0000-0000-0000-000000000002', 1),
  ('a5310000-0000-0000-0000-000000000010', 'a5300000-0000-0000-0000-000000000005', 'a5100000-0000-0000-0000-000000000007', 1),
  ('a5310000-0000-0000-0000-000000000011', 'a5300000-0000-0000-0000-000000000005', 'a5200000-0000-0000-0000-000000000003', 1),
  ('a5310000-0000-0000-0000-000000000012', 'a5300000-0000-0000-0000-000000000006', 'a5100000-0000-0000-0000-000000000010', 1),
  ('a5310000-0000-0000-0000-000000000013', 'a5300000-0000-0000-0000-000000000006', 'a5200000-0000-0000-0000-000000000007', 1),
  ('a5310000-0000-0000-0000-000000000014', 'a5300000-0000-0000-0000-000000000007', 'a5100000-0000-0000-0000-000000000009', 1),
  ('a5310000-0000-0000-0000-000000000015', 'a5300000-0000-0000-0000-000000000007', 'a5200000-0000-0000-0000-000000000007', 1),
  ('a5310000-0000-0000-0000-000000000016', 'a5300000-0000-0000-0000-000000000008', 'a5100000-0000-0000-0000-000000000008', 1),
  ('a5310000-0000-0000-0000-000000000017', 'a5300000-0000-0000-0000-000000000008', 'a5200000-0000-0000-0000-000000000008', 1)
ON CONFLICT (id) DO NOTHING;

-- ============================================================
-- 4. REGLES METIER (4) : une de chaque nature utile a la demonstration
-- ============================================================
INSERT INTO business_rules (id, name, rule_type, source_item_id, target_item_id, description, active, blocking, created_by_id, created_at) VALUES
  ('a5500000-0000-0000-0000-000000000001', 'Un seul routeur par offre',      'INCOMPATIBILITY',       'a5100000-0000-0000-0000-000000000004', 'a5100000-0000-0000-0000-000000000005', 'Le routeur 4G+ et le routeur 5G Pro ne peuvent pas figurer dans la même offre.',                     true, true,  'c0000000-0000-0000-0000-000000000011', now() - interval '40 days'),
  ('a5500000-0000-0000-0000-000000000002', 'Le X2 Pro exige une SIM 5G',     'MANDATORY_COMPOSITION', 'a5100000-0000-0000-0000-000000000002', 'a5100000-0000-0000-0000-000000000007', 'Une offre avec le Smartphone X2 Pro doit inclure une carte SIM 5G. Avertissement seulement.',        true, false, 'c0000000-0000-0000-0000-000000000011', now() - interval '40 days'),
  ('a5500000-0000-0000-0000-000000000003', 'Clé 4G+ et Data 10 Go vont ensemble', 'COMPATIBILITY',    'a5100000-0000-0000-0000-000000000006', 'a5200000-0000-0000-0000-000000000001', 'Association recommandée pour les offres nomades.',                                                    true, false, 'c0000000-0000-0000-0000-000000000011', now() - interval '39 days'),
  ('a5500000-0000-0000-0000-000000000004', 'Box fibre ou modem, pas les deux', 'INCOMPATIBILITY',     'a5100000-0000-0000-0000-000000000008', 'a5100000-0000-0000-0000-000000000010', 'Une offre fixe et une offre nomade ne se combinent pas.',                                            true, true,  'c0000000-0000-0000-0000-000000000016', now() - interval '38 days')
ON CONFLICT (id) DO NOTHING;

-- ============================================================
-- 5. OFFRES (10), une par etape significative du circuit
-- ============================================================
INSERT INTO offers (id, name, short_description, long_description, seo_title, seo_description, status, promotional_price, currency, valid_from, valid_until, target_segment, customer_type, quality_score, publish_date, legal_mentions, created_by_id, enriched_by_id, assigned_to_id, current_version, version, category_id, category_type, created_at, updated_at) VALUES
  -- o1 PUBLIEE, circuit complet en 6 jours
  ('a5400000-0000-0000-0000-000000000001', 'Smart 10 Go', 'Forfait Internet mobile de 10 Go, valable 30 jours.',
   'Smart 10 Go, c''est 10 Go d''Internet 4G/5G pour un mois entier : réseaux sociaux, vidéos et travail à distance sans compter. Activation immédiate par USSD ou depuis l''application Moov.',
   'Smart 10 Go : forfait Internet mobile 10 Go à 5 000 F', 'Le forfait Internet mobile 10 Go de Moov Africa Burkina Faso, valable 30 jours, activation immédiate.',
   'PUBLISHED', 5000, 'XOF', now() - interval '20 days', now() + interval '160 days', 'PREPAID', 'INDIVIDUAL', 100, now() - interval '20 days',
   'Offre valable pour les clients prépayés Moov Africa Burkina Faso. Volume non reportable. Débit réduit au-delà du volume.',
   'c0000000-0000-0000-0000-000000000011', 'c0000000-0000-0000-0000-000000000015', 'c0000000-0000-0000-0000-000000000015', 6, 0, 'd2000000-0000-0000-0000-000000000012', 'OFFER', now() - interval '26 days', now() - interval '20 days'),
  -- o2 PUBLIEE, offre combinee
  ('a5400000-0000-0000-0000-000000000002', 'Pack Connecté Moov X2', 'Le Smartphone Moov X2 et 10 Go par mois, en un seul achat.',
   'Le Pack Connecté réunit le Smartphone Moov X2 et un forfait Data 10 Go : tout ce qu''il faut pour démarrer connecté dès la sortie de la boutique.',
   'Pack Connecté Moov X2 : smartphone + 10 Go', 'Smartphone Moov X2 avec forfait Internet 10 Go inclus, disponible en boutique Moov Africa.',
   'PUBLISHED', 48000, 'XOF', now() - interval '12 days', now() + interval '80 days', 'PREPAID', 'INDIVIDUAL', 100, now() - interval '12 days',
   'Dans la limite des stocks disponibles. Garantie constructeur 12 mois.',
   'c0000000-0000-0000-0000-000000000011', 'c0000000-0000-0000-0000-000000000015', 'c0000000-0000-0000-0000-000000000015', 6, 0, 'd2000000-0000-0000-0000-000000000015', 'OFFER', now() - interval '19 days', now() - interval '12 days'),
  -- o3 VALIDEE : attend la decision du chef de departement
  ('a5400000-0000-0000-0000-000000000003', 'Maison 4G+ Illimitée', 'Internet 4G+ pour toute la maison avec routeur inclus.',
   'Maison 4G+ Illimitée apporte l''Internet haut débit à domicile sans travaux : le routeur 4G+ est fourni et le forfait Data 10 Go se renouvelle chaque mois.',
   'Maison 4G+ : Internet à domicile sans travaux', 'Routeur 4G+ et forfait Data mensuel pour toute la famille, installation immédiate.',
   'VALIDATED', 42000, 'XOF', now() + interval '5 days', now() + interval '185 days', 'HYBRID', 'ALL', 100, NULL,
   'Couverture 4G+ requise à l''adresse d''installation. Routeur non remboursable après ouverture.',
   'c0000000-0000-0000-0000-000000000011', 'c0000000-0000-0000-0000-000000000015', 'c0000000-0000-0000-0000-000000000015', 5, 0, 'd2000000-0000-0000-0000-000000000015', 'OFFER', now() - interval '10 days', now() - interval '1 day'),
  -- o4 EN VALIDATION : attend le chef de service
  ('a5400000-0000-0000-0000-000000000004', 'Fibre Famille 50 Mbit/s', 'La fibre optique à la maison avec routeur 5G Pro.',
   'Fibre Famille combine l''abonnement fibre 50 Mbit/s et le routeur 5G Pro Wi-Fi 6 : streaming en 4K, télétravail et jeux en ligne pour toute la famille.',
   'Fibre Famille 50 Mbit/s : la fibre chez vous', 'Abonnement fibre optique 50 Mbit/s avec routeur Wi-Fi 6 inclus, Moov Africa Burkina Faso.',
   'IN_VALIDATION', 110000, 'XOF', now() + interval '15 days', now() + interval '380 days', 'POSTPAID', 'INDIVIDUAL', 100, NULL,
   'Éligibilité fibre à vérifier. Engagement 12 mois. Frais de raccordement offerts.',
   'c0000000-0000-0000-0000-000000000011', 'c0000000-0000-0000-0000-000000000015', 'c0000000-0000-0000-0000-000000000015', 4, 0, 'd2000000-0000-0000-0000-000000000015', 'OFFER', now() - interval '6 days', now() - interval '1 day'),
  -- o5 EN ENRICHISSEMENT : confiee a l analyste, descriptions pas encore ecrites
  ('a5400000-0000-0000-0000-000000000005', 'Étudiant Connecté', NULL, NULL, NULL, NULL,
   'IN_ENRICHMENT', 16000, 'XOF', now() + interval '20 days', now() + interval '110 days', 'PREPAID', 'INDIVIDUAL', 65, NULL,
   'Sur présentation d''une carte d''étudiant en cours de validité.',
   'c0000000-0000-0000-0000-000000000011', NULL, 'c0000000-0000-0000-0000-000000000015', 2, 0, 'd2000000-0000-0000-0000-000000000016', 'OFFER', now() - interval '3 days', now() - interval '2 days'),
  -- o6 BROUILLON : tout juste creee
  ('a5400000-0000-0000-0000-000000000006', 'Voyageur Afrique', NULL, NULL, NULL, NULL,
   'DRAFT', 6000, 'XOF', NULL, NULL, 'PREPAID', 'ALL', 45, NULL, NULL,
   'c0000000-0000-0000-0000-000000000011', NULL, NULL, 1, 0, 'd2000000-0000-0000-0000-000000000011', 'OFFER', now() - interval '1 day', now() - interval '1 day'),
  -- o7 SUSPENDUE : publiee puis retiree du marche temporairement
  ('a5400000-0000-0000-0000-000000000007', 'Voix 200 Pro', '200 minutes vers tous les réseaux pour les professionnels.',
   'Voix 200 Pro offre 200 minutes d''appels nationaux tous réseaux, avec facturation mensuelle et relevé détaillé pour les indépendants et petites entreprises.',
   'Voix 200 Pro : 200 minutes tous réseaux', 'Forfait voix professionnel 200 minutes, facturation mensuelle, Moov Africa Burkina Faso.',
   'SUSPENDED', 3500, 'XOF', now() - interval '35 days', now() + interval '145 days', 'POSTPAID', 'BUSINESS', 100, now() - interval '30 days',
   'Réservé aux clients professionnels. Minutes non reportables.',
   'c0000000-0000-0000-0000-000000000011', 'c0000000-0000-0000-0000-000000000015', 'c0000000-0000-0000-0000-000000000015', 7, 0, 'd2000000-0000-0000-0000-000000000013', 'OFFER', now() - interval '40 days', now() - interval '4 days'),
  -- o8 PUBLIEE (second chef de produit)
  ('a5400000-0000-0000-0000-000000000008', 'Nomade 4G MiFi', 'Internet partout avec le modem de poche et 2 Go chaque nuit.',
   'Nomade 4G MiFi réunit le modem de poche 4G et le Pass Data Nuit 2 Go : jusqu''à 10 appareils connectés, où que vous soyez.',
   'Nomade 4G MiFi : Internet de poche', 'Modem 4G MiFi et pass data nuit inclus, pour se connecter partout au Burkina Faso.',
   'PUBLISHED', 28000, 'XOF', now() - interval '8 days', now() + interval '172 days', 'PREPAID', 'INDIVIDUAL', 100, now() - interval '8 days',
   'Couverture 4G requise. Modem garanti 6 mois.',
   'c0000000-0000-0000-0000-000000000016', 'c0000000-0000-0000-0000-000000000015', 'c0000000-0000-0000-0000-000000000015', 6, 0, 'd2000000-0000-0000-0000-000000000011', 'OFFER', now() - interval '16 days', now() - interval '8 days'),
  -- o9 PLANIFIEE : sera publiee automatiquement au debut de validite
  ('a5400000-0000-0000-0000-000000000009', 'Entreprise Connectée', 'Fibre et flotte de 10 lignes pour les PME.',
   'Entreprise Connectée équipe votre PME d''une box fibre FTTH et d''une flotte de 10 lignes avec appels internes illimités, sur une seule facture mensuelle.',
   'Entreprise Connectée : fibre + flotte 10 lignes', 'Offre PME Moov Africa : box fibre FTTH et 10 lignes professionnelles, facture unique.',
   'PLANNED', 105000, 'XOF', now() + interval '10 days', now() + interval '375 days', 'POSTPAID', 'BUSINESS', 100, NULL,
   'Réservé aux entreprises immatriculées. Engagement 24 mois.',
   'c0000000-0000-0000-0000-000000000016', 'c0000000-0000-0000-0000-000000000015', 'c0000000-0000-0000-0000-000000000015', 6, 0, 'd2000000-0000-0000-0000-000000000017', 'OFFER', now() - interval '14 days', now() - interval '2 days'),
  -- o10 BROUILLON apres rejet : le chef de service a renvoye la fiche avec motif
  ('a5400000-0000-0000-0000-000000000010', 'Tablette Famille', 'La tablette Moov Tab 10 avec 2 Go chaque nuit.',
   'Tablette Famille : la Moov Tab 10 pouces pour les devoirs et les dessins animés, avec le Pass Data Nuit 2 Go inclus.',
   NULL, NULL,
   'DRAFT', 118000, 'XOF', now() + interval '30 days', now() + interval '120 days', 'PREPAID', 'INDIVIDUAL', 75, NULL,
   'Dans la limite des stocks disponibles.',
   'c0000000-0000-0000-0000-000000000016', 'c0000000-0000-0000-0000-000000000015', 'c0000000-0000-0000-0000-000000000015', 5, 0, 'd2000000-0000-0000-0000-000000000015', 'OFFER', now() - interval '9 days', now() - interval '1 day')
ON CONFLICT (id) DO NOTHING;

INSERT INTO offer_items (id, offer_id, catalog_item_id) VALUES
  ('a5410000-0000-0000-0000-000000000001', 'a5400000-0000-0000-0000-000000000001', 'a5200000-0000-0000-0000-000000000001'),
  ('a5410000-0000-0000-0000-000000000002', 'a5400000-0000-0000-0000-000000000002', 'a5300000-0000-0000-0000-000000000001'),
  ('a5410000-0000-0000-0000-000000000003', 'a5400000-0000-0000-0000-000000000003', 'a5300000-0000-0000-0000-000000000002'),
  ('a5410000-0000-0000-0000-000000000004', 'a5400000-0000-0000-0000-000000000004', 'a5300000-0000-0000-0000-000000000003'),
  ('a5410000-0000-0000-0000-000000000005', 'a5400000-0000-0000-0000-000000000005', 'a5300000-0000-0000-0000-000000000004'),
  ('a5410000-0000-0000-0000-000000000006', 'a5400000-0000-0000-0000-000000000006', 'a5300000-0000-0000-0000-000000000005'),
  ('a5410000-0000-0000-0000-000000000007', 'a5400000-0000-0000-0000-000000000007', 'a5200000-0000-0000-0000-000000000002'),
  ('a5410000-0000-0000-0000-000000000008', 'a5400000-0000-0000-0000-000000000008', 'a5300000-0000-0000-0000-000000000006'),
  ('a5410000-0000-0000-0000-000000000009', 'a5400000-0000-0000-0000-000000000009', 'a5300000-0000-0000-0000-000000000008'),
  ('a5410000-0000-0000-0000-000000000010', 'a5400000-0000-0000-0000-000000000010', 'a5300000-0000-0000-0000-000000000007')
ON CONFLICT (id) DO NOTHING;

-- ============================================================
-- 6. PARCOURS DES OFFRES : historique, versions et evenements KPI
--    Les trois tables racontent la meme chose et doivent concorder : l ecran
--    Indicateurs lit kpi_events, la fiche lit l historique et les versions.
-- ============================================================
INSERT INTO offer_status_history (id, offer_id, from_status, to_status, changed_by_id, comment, created_at) VALUES
  -- o1 : Smart 10 Go, publiee en 6 jours
  ('a5420000-0000-0000-0000-000000000101', 'a5400000-0000-0000-0000-000000000001', 'DRAFT',          'IN_ENRICHMENT', 'c0000000-0000-0000-0000-000000000011', NULL, now() - interval '25 days'),
  ('a5420000-0000-0000-0000-000000000102', 'a5400000-0000-0000-0000-000000000001', 'IN_ENRICHMENT',  'IN_VALIDATION', 'c0000000-0000-0000-0000-000000000015', NULL, now() - interval '23 days'),
  ('a5420000-0000-0000-0000-000000000103', 'a5400000-0000-0000-0000-000000000001', 'IN_VALIDATION',  'VALIDATED',     'c0000000-0000-0000-0000-000000000012', 'Composition et tarif conformes à la grille.', now() - interval '22 days'),
  ('a5420000-0000-0000-0000-000000000104', 'a5400000-0000-0000-0000-000000000001', 'VALIDATED',      'PUBLISHED',     'c0000000-0000-0000-0000-000000000013', 'Mentions légales vérifiées.', now() - interval '20 days'),
  -- o2 : Pack Connecte, un aller-retour en enrichissement avant validation
  ('a5420000-0000-0000-0000-000000000201', 'a5400000-0000-0000-0000-000000000002', 'DRAFT',          'IN_ENRICHMENT', 'c0000000-0000-0000-0000-000000000011', NULL, now() - interval '18 days'),
  ('a5420000-0000-0000-0000-000000000202', 'a5400000-0000-0000-0000-000000000002', 'IN_ENRICHMENT',  'IN_VALIDATION', 'c0000000-0000-0000-0000-000000000015', NULL, now() - interval '16 days'),
  ('a5420000-0000-0000-0000-000000000203', 'a5400000-0000-0000-0000-000000000002', 'IN_VALIDATION',  'IN_ENRICHMENT', 'c0000000-0000-0000-0000-000000000012', 'La description longue ne mentionne pas la garantie du téléphone : à compléter.', now() - interval '15 days'),
  ('a5420000-0000-0000-0000-000000000204', 'a5400000-0000-0000-0000-000000000002', 'IN_ENRICHMENT',  'IN_VALIDATION', 'c0000000-0000-0000-0000-000000000015', 'Garantie ajoutée aux mentions légales.', now() - interval '14 days'),
  ('a5420000-0000-0000-0000-000000000205', 'a5400000-0000-0000-0000-000000000002', 'IN_VALIDATION',  'VALIDATED',     'c0000000-0000-0000-0000-000000000012', NULL, now() - interval '13 days'),
  ('a5420000-0000-0000-0000-000000000206', 'a5400000-0000-0000-0000-000000000002', 'VALIDATED',      'PUBLISHED',     'c0000000-0000-0000-0000-000000000013', NULL, now() - interval '12 days'),
  -- o3 : Maison 4G+, validee, en attente de decision
  ('a5420000-0000-0000-0000-000000000301', 'a5400000-0000-0000-0000-000000000003', 'DRAFT',          'IN_ENRICHMENT', 'c0000000-0000-0000-0000-000000000011', NULL, now() - interval '9 days'),
  ('a5420000-0000-0000-0000-000000000302', 'a5400000-0000-0000-0000-000000000003', 'IN_ENRICHMENT',  'IN_VALIDATION', 'c0000000-0000-0000-0000-000000000015', NULL, now() - interval '4 days'),
  ('a5420000-0000-0000-0000-000000000303', 'a5400000-0000-0000-0000-000000000003', 'IN_VALIDATION',  'VALIDATED',     'c0000000-0000-0000-0000-000000000012', 'Validée. Vérifier la couverture 4G+ dans les mentions avant publication.', now() - interval '1 day'),
  -- o4 : Fibre Famille, soumise au chef de service
  ('a5420000-0000-0000-0000-000000000401', 'a5400000-0000-0000-0000-000000000004', 'DRAFT',          'IN_ENRICHMENT', 'c0000000-0000-0000-0000-000000000011', NULL, now() - interval '5 days'),
  ('a5420000-0000-0000-0000-000000000402', 'a5400000-0000-0000-0000-000000000004', 'IN_ENRICHMENT',  'IN_VALIDATION', 'c0000000-0000-0000-0000-000000000015', NULL, now() - interval '1 day'),
  -- o5 : Etudiant Connecte, en enrichissement
  ('a5420000-0000-0000-0000-000000000501', 'a5400000-0000-0000-0000-000000000005', 'DRAFT',          'IN_ENRICHMENT', 'c0000000-0000-0000-0000-000000000011', NULL, now() - interval '2 days'),
  -- o7 : Voix 200 Pro, publiee puis suspendue
  ('a5420000-0000-0000-0000-000000000701', 'a5400000-0000-0000-0000-000000000007', 'DRAFT',          'IN_ENRICHMENT', 'c0000000-0000-0000-0000-000000000011', NULL, now() - interval '38 days'),
  ('a5420000-0000-0000-0000-000000000702', 'a5400000-0000-0000-0000-000000000007', 'IN_ENRICHMENT',  'IN_VALIDATION', 'c0000000-0000-0000-0000-000000000015', NULL, now() - interval '35 days'),
  ('a5420000-0000-0000-0000-000000000703', 'a5400000-0000-0000-0000-000000000007', 'IN_VALIDATION',  'VALIDATED',     'c0000000-0000-0000-0000-000000000012', NULL, now() - interval '33 days'),
  ('a5420000-0000-0000-0000-000000000704', 'a5400000-0000-0000-0000-000000000007', 'VALIDATED',      'PUBLISHED',     'c0000000-0000-0000-0000-000000000013', NULL, now() - interval '30 days'),
  ('a5420000-0000-0000-0000-000000000705', 'a5400000-0000-0000-0000-000000000007', 'PUBLISHED',      'SUSPENDED',     'c0000000-0000-0000-0000-000000000013', 'Suspendue le temps de renégocier le tarif d''interconnexion.', now() - interval '4 days'),
  -- o8 : Nomade 4G MiFi, publiee
  ('a5420000-0000-0000-0000-000000000801', 'a5400000-0000-0000-0000-000000000008', 'DRAFT',          'IN_ENRICHMENT', 'c0000000-0000-0000-0000-000000000016', NULL, now() - interval '15 days'),
  ('a5420000-0000-0000-0000-000000000802', 'a5400000-0000-0000-0000-000000000008', 'IN_ENRICHMENT',  'IN_VALIDATION', 'c0000000-0000-0000-0000-000000000015', NULL, now() - interval '11 days'),
  ('a5420000-0000-0000-0000-000000000803', 'a5400000-0000-0000-0000-000000000008', 'IN_VALIDATION',  'VALIDATED',     'c0000000-0000-0000-0000-000000000012', NULL, now() - interval '9 days'),
  ('a5420000-0000-0000-0000-000000000804', 'a5400000-0000-0000-0000-000000000008', 'VALIDATED',      'PUBLISHED',     'c0000000-0000-0000-0000-000000000013', NULL, now() - interval '8 days'),
  -- o9 : Entreprise Connectee, planifiee
  ('a5420000-0000-0000-0000-000000000901', 'a5400000-0000-0000-0000-000000000009', 'DRAFT',          'IN_ENRICHMENT', 'c0000000-0000-0000-0000-000000000016', NULL, now() - interval '13 days'),
  ('a5420000-0000-0000-0000-000000000902', 'a5400000-0000-0000-0000-000000000009', 'IN_ENRICHMENT',  'IN_VALIDATION', 'c0000000-0000-0000-0000-000000000015', NULL, now() - interval '7 days'),
  ('a5420000-0000-0000-0000-000000000903', 'a5400000-0000-0000-0000-000000000009', 'IN_VALIDATION',  'VALIDATED',     'c0000000-0000-0000-0000-000000000012', NULL, now() - interval '4 days'),
  ('a5420000-0000-0000-0000-000000000904', 'a5400000-0000-0000-0000-000000000009', 'VALIDATED',      'PLANNED',       'c0000000-0000-0000-0000-000000000013', 'Lancement aligné sur la campagne PME du mois prochain.', now() - interval '2 days'),
  -- o10 : Tablette Famille, rejetee et renvoyee au brouillon
  ('a5420000-0000-0000-0000-000000001001', 'a5400000-0000-0000-0000-000000000010', 'DRAFT',          'IN_ENRICHMENT', 'c0000000-0000-0000-0000-000000000016', NULL, now() - interval '8 days'),
  ('a5420000-0000-0000-0000-000000001002', 'a5400000-0000-0000-0000-000000000010', 'IN_ENRICHMENT',  'IN_VALIDATION', 'c0000000-0000-0000-0000-000000000015', NULL, now() - interval '5 days'),
  ('a5420000-0000-0000-0000-000000001003', 'a5400000-0000-0000-0000-000000000010', 'IN_VALIDATION',  'IN_ENRICHMENT', 'c0000000-0000-0000-0000-000000000012', 'Le prix promotionnel est supérieur au prix du pack seul : à revoir avec le chef de produit.', now() - interval '3 days'),
  ('a5420000-0000-0000-0000-000000001004', 'a5400000-0000-0000-0000-000000000010', 'IN_ENRICHMENT',  'DRAFT',         'c0000000-0000-0000-0000-000000000015', 'Retour au chef de produit pour correction du tarif.', now() - interval '1 day')
ON CONFLICT (id) DO NOTHING;

-- Versions : un instantane par transition, dans le meme ordre que l historique.
INSERT INTO offer_versions (id, offer_id, version_number, snapshot, changed_by_id, change_description, created_at)
SELECT
  ('a5430000-0000-0000-0000-' || lpad(substr(h.id::text, 33, 4) || '0000', 12, '0'))::uuid,
  h.offer_id,
  row_number() OVER (PARTITION BY h.offer_id ORDER BY h.created_at),
  jsonb_build_object(
    'name', o.name, 'status', h.to_status,
    'shortDescription', coalesce(o.short_description, ''), 'longDescription', coalesce(o.long_description, ''),
    'seoTitle', coalesce(o.seo_title, ''), 'seoDescription', coalesce(o.seo_description, ''),
    'promotionalPrice', coalesce(o.promotional_price::text, ''), 'legalMentions', coalesce(o.legal_mentions, ''),
    'qualityScore', o.quality_score,
    'validFrom', coalesce(o.valid_from::text, ''), 'validUntil', coalesce(o.valid_until::text, ''),
    'targetSegment', coalesce(o.target_segment, ''), 'customerType', coalesce(o.customer_type, ''),
    'catalogItemIds', (SELECT coalesce(jsonb_agg(oi.catalog_item_id::text ORDER BY oi.catalog_item_id), '[]'::jsonb) FROM offer_items oi WHERE oi.offer_id = o.id)
  ),
  h.changed_by_id,
  'Transition vers ' || h.to_status,
  h.created_at
FROM offer_status_history h
JOIN offers o ON o.id = h.offer_id
WHERE h.id::text LIKE 'a5420000-%'
ON CONFLICT (id) DO NOTHING;

-- Evenements KPI : la creation, puis chaque transition.
INSERT INTO kpi_events (id, offer_id, event_type, actor_id, duration_ms, created_at)
SELECT ('a5440000-0000-0000-0000-' || lpad(substr(o.id::text, 33, 4) || '0001', 12, '0'))::uuid,
       o.id, 'OFFER_CREATED', o.created_by_id, NULL, o.created_at
FROM offers o WHERE o.id::text LIKE 'a5400000-%'
ON CONFLICT (id) DO NOTHING;

INSERT INTO kpi_events (id, offer_id, event_type, actor_id, duration_ms, created_at)
SELECT ('a5440000-0000-0000-0000-' || lpad(substr(h.id::text, 33, 4) || '0002', 12, '0'))::uuid,
       h.offer_id, 'STATUS_' || h.to_status, h.changed_by_id, NULL, h.created_at
FROM offer_status_history h WHERE h.id::text LIKE 'a5420000-%'
ON CONFLICT (id) DO NOTHING;

-- ============================================================
-- 7. DIFFUSION : les offres publiees sont a disposition des systemes tiers
-- ============================================================
INSERT INTO integration_exports (id, target_system, offer_id, export_type, status, idempotency_key, payload, error_message, retry_count, created_at, completed_at, delivery_mode, endpoint_url, http_status, consumed_at, consumed_count)
SELECT ('a5800000-0000-0000-0000-' || lpad(substr(o.id::text, 33, 4) || t.n, 12, '0'))::uuid,
       t.target, o.id, 'AUTO_PUBLISH', 'PENDING',
       o.id::text || '_' || t.target || '_seed',
       jsonb_build_object('offerId', o.id, 'name', o.name, 'type', 'OFFER', 'status', 'PUBLISHED',
                          'version', o.current_version, 'price', o.promotional_price, 'currency', o.currency,
                          'shortDescription', o.short_description, 'validFrom', o.valid_from, 'validUntil', o.valid_until),
       NULL, 0, o.publish_date, NULL, 'PULL', NULL, NULL, NULL, 0
FROM offers o
CROSS JOIN (VALUES ('CRM', '0001'), ('CALL_CENTER', '0002'), ('WEBSITE', '0003')) AS t(target, n)
WHERE o.id::text LIKE 'a5400000-%' AND o.status IN ('PUBLISHED', 'SUSPENDED')
ON CONFLICT (id) DO NOTHING;

-- ============================================================
-- 8. TESTS A/B (4) : un par etat
-- ============================================================
INSERT INTO ab_tests (id, offer_id, variant_a, variant_b, metric, status, winner, created_by_id, created_at) VALUES
  ('a5600000-0000-0000-0000-000000000001', 'a5400000-0000-0000-0000-000000000001', 'Smart 10 Go à 5 000 F', '10 Go + 100 SMS à 5 000 F', 'Taux de conversion', 'RUNNING',   NULL, 'c0000000-0000-0000-0000-000000000015', now() - interval '10 days'),
  ('a5600000-0000-0000-0000-000000000002', 'a5400000-0000-0000-0000-000000000002', 'Visuel téléphone seul', 'Visuel famille avec le téléphone', 'Clics sur la publicité', 'COMPLETED', 'B', 'c0000000-0000-0000-0000-000000000015', now() - interval '11 days'),
  ('a5600000-0000-0000-0000-000000000003', 'a5400000-0000-0000-0000-000000000008', 'Titre « Internet de poche »', 'Titre « Votre Wi-Fi partout »', 'Taux d''ouverture SMS', 'DRAFT', NULL, 'c0000000-0000-0000-0000-000000000015', now() - interval '2 days'),
  ('a5600000-0000-0000-0000-000000000004', 'a5400000-0000-0000-0000-000000000007', 'Voix 200 Pro à 3 500 F', 'Voix 200 Pro à 3 900 F avec SMS illimités', 'Coût d''acquisition', 'CANCELLED', NULL, 'c0000000-0000-0000-0000-000000000015', now() - interval '20 days')
ON CONFLICT (id) DO NOTHING;

-- ============================================================
-- 9. CAMPAGNES (3) : diffusee, programmee, en preparation
-- ============================================================
INSERT INTO campaigns (id, name, offer_id, status, scheduled_at, published_at, created_by_id, created_at, media_asset_id) VALUES
  ('a5700000-0000-0000-0000-000000000001', 'Lancement Smart 10 Go',          'a5400000-0000-0000-0000-000000000001', 'PUBLISHED', now() - interval '19 days', now() - interval '19 days', 'c0000000-0000-0000-0000-000000000014', now() - interval '20 days', NULL),
  ('a5700000-0000-0000-0000-000000000002', 'Rentrée connectée : Pack X2',    'a5400000-0000-0000-0000-000000000002', 'SCHEDULED', now() + interval '3 days',  NULL,                       'c0000000-0000-0000-0000-000000000014', now() - interval '2 days',  NULL),
  ('a5700000-0000-0000-0000-000000000003', 'Nomade 4G : Internet partout',   'a5400000-0000-0000-0000-000000000008', 'DRAFT',     NULL,                       NULL,                       'c0000000-0000-0000-0000-000000000014', now() - interval '1 day',   NULL)
ON CONFLICT (id) DO NOTHING;

INSERT INTO campaign_channels (id, campaign_id, channel_type, message, status, sent_at) VALUES
  ('a5710000-0000-0000-0000-000000000001', 'a5700000-0000-0000-0000-000000000001', 'SMS',       'Nouveau : Smart 10 Go, 10 Go d''Internet pour 30 jours à 5 000 F. Composez *555# pour l''activer.', 'SENT', now() - interval '19 days'),
  ('a5710000-0000-0000-0000-000000000002', 'a5700000-0000-0000-0000-000000000001', 'FACEBOOK',  'Smart 10 Go est arrivé : un mois d''Internet 4G/5G pour 5 000 F. Activez-le depuis l''application Moov.', 'SENT', now() - interval '19 days'),
  ('a5710000-0000-0000-0000-000000000003', 'a5700000-0000-0000-0000-000000000002', 'FACEBOOK',  'La rentrée connectée avec le Pack Connecté Moov X2 : smartphone + 10 Go pour 48 000 F.', 'PENDING', NULL),
  ('a5710000-0000-0000-0000-000000000004', 'a5700000-0000-0000-0000-000000000002', 'INSTAGRAM', 'Pack Connecté Moov X2 : votre smartphone et 10 Go, en boutique dès maintenant.', 'PENDING', NULL),
  ('a5710000-0000-0000-0000-000000000005', 'a5700000-0000-0000-0000-000000000003', 'LINKEDIN',  'Nomade 4G MiFi : jusqu''à 10 appareils connectés, partout au Burkina Faso.', 'PENDING', NULL)
ON CONFLICT (id) DO NOTHING;

-- Le numero de version courant suit le nombre d instantanes deja pris.
UPDATE offers o
SET current_version = (SELECT count(*) + 1 FROM offer_versions v WHERE v.offer_id = o.id)
WHERE o.id::text LIKE 'a5400000-%';
