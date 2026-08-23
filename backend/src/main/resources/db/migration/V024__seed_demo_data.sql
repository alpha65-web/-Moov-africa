-- Jeu de donnees de demonstration pour la plateforme PIM Moov Africa.
-- Toutes les insertions sont idempotentes (ON CONFLICT DO NOTHING) et rejouables.
-- Auteur des donnees : alpha@moov-africa.bf (c0000000-0000-0000-0000-000000000002)
-- Les medias (media_assets) ne sont volontairement pas seedes : ils exigent des
-- fichiers reellement presents dans MinIO, sans quoi le telechargement echouerait.

-- ============================================================
-- 1. CATEGORIES (arbre a 2 niveaux)
-- ============================================================
INSERT INTO categories (id, name, description, parent_id, level, created_at) VALUES
  ('d1000000-0000-0000-0000-000000000001', 'Data', 'Offres et forfaits Internet mobile', NULL, 0, now()),
  ('d1000000-0000-0000-0000-000000000002', 'Voix', 'Communications vocales et SMS', NULL, 0, now()),
  ('d1000000-0000-0000-0000-000000000003', 'Mobile Money', 'Services financiers Moov Money', NULL, 0, now()),
  ('d1000000-0000-0000-0000-000000000004', 'Packs & Bundles', 'Offres combinees multi-services', NULL, 0, now()),
  ('d1000000-0000-0000-0000-000000000005', 'Equipements', 'Terminaux, SIM et accessoires', NULL, 0, now()),
  ('d1000000-0000-0000-0000-000000000011', 'Forfaits Data', 'Forfaits Internet a validite mensuelle', 'd1000000-0000-0000-0000-000000000001', 1, now()),
  ('d1000000-0000-0000-0000-000000000012', 'Pass Internet', 'Pass Internet courte duree', 'd1000000-0000-0000-0000-000000000001', 1, now()),
  ('d1000000-0000-0000-0000-000000000021', 'Forfaits Voix', 'Minutes nationales et internationales', 'd1000000-0000-0000-0000-000000000002', 1, now())
ON CONFLICT (id) DO NOTHING;

-- ============================================================
-- 2. CATALOGUE : items de base
-- ============================================================
INSERT INTO catalog_items (id, item_type, name, description, status, base_price, currency, category_id, created_by_id, version, created_at, updated_at) VALUES
  ('e1000000-0000-0000-0000-000000000001', 'SERVICE', 'Forfait Data 5 Go', 'Forfait Internet mobile de 5 Go valable 30 jours sur l ensemble du reseau 4G/5G Moov Africa.', 'ACTIVE', 3000.00, 'XOF', 'd1000000-0000-0000-0000-000000000011', 'c0000000-0000-0000-0000-000000000002', 0, now(), now()),
  ('e1000000-0000-0000-0000-000000000002', 'SERVICE', 'Forfait Data 15 Go', 'Forfait Internet mobile de 15 Go valable 30 jours, ideal pour le streaming et le teletravail.', 'ACTIVE', 7500.00, 'XOF', 'd1000000-0000-0000-0000-000000000011', 'c0000000-0000-0000-0000-000000000002', 0, now(), now()),
  ('e1000000-0000-0000-0000-000000000003', 'SERVICE', 'Pass Internet Journalier 500 Mo', 'Pass Internet de 500 Mo valable 24 heures.', 'ACTIVE', 200.00, 'XOF', 'd1000000-0000-0000-0000-000000000012', 'c0000000-0000-0000-0000-000000000002', 0, now(), now()),
  ('e1000000-0000-0000-0000-000000000004', 'SERVICE', 'Pass Internet Hebdomadaire 3 Go', 'Pass Internet de 3 Go valable 7 jours.', 'ACTIVE', 1500.00, 'XOF', 'd1000000-0000-0000-0000-000000000012', 'c0000000-0000-0000-0000-000000000002', 0, now(), now()),
  ('e1000000-0000-0000-0000-000000000005', 'SERVICE', 'Forfait Voix 120 minutes', '120 minutes d appels nationaux valables 30 jours, tous reseaux.', 'ACTIVE', 2500.00, 'XOF', 'd1000000-0000-0000-0000-000000000021', 'c0000000-0000-0000-0000-000000000002', 0, now(), now()),
  ('e1000000-0000-0000-0000-000000000006', 'SERVICE', 'Forfait Voix International 60 minutes', '60 minutes vers l Europe et l Afrique de l Ouest, valables 30 jours.', 'ACTIVE', 5000.00, 'XOF', 'd1000000-0000-0000-0000-000000000021', 'c0000000-0000-0000-0000-000000000002', 0, now(), now()),
  ('e1000000-0000-0000-0000-000000000007', 'SERVICE', 'Moov Money Transfert', 'Service de transfert d argent national via Moov Money.', 'ACTIVE', 0.00, 'XOF', 'd1000000-0000-0000-0000-000000000003', 'c0000000-0000-0000-0000-000000000002', 0, now(), now()),
  ('e1000000-0000-0000-0000-000000000008', 'SERVICE', 'Moov Money Paiement Marchand', 'Paiement chez les commercants partenaires via Moov Money.', 'ACTIVE', 0.00, 'XOF', 'd1000000-0000-0000-0000-000000000003', 'c0000000-0000-0000-0000-000000000002', 0, now(), now()),
  ('e1000000-0000-0000-0000-000000000009', 'SERVICE', 'Forfait Data 50 Go', 'Forfait Internet mobile de 50 Go valable 30 jours pour les usages intensifs.', 'ARCHIVED', 20000.00, 'XOF', 'd1000000-0000-0000-0000-000000000011', 'c0000000-0000-0000-0000-000000000002', 0, now(), now()),
  ('e1000000-0000-0000-0000-000000000010', 'PRODUCT', 'Carte SIM 4G', 'Carte SIM 4G/5G prete a l emploi avec credit de bienvenue.', 'ACTIVE', 500.00, 'XOF', 'd1000000-0000-0000-0000-000000000005', 'c0000000-0000-0000-0000-000000000002', 0, now(), now()),
  ('e1000000-0000-0000-0000-000000000011', 'PRODUCT', 'Routeur 4G LTE', 'Routeur 4G LTE domestique, jusqu a 32 connexions simultanees.', 'ACTIVE', 35000.00, 'XOF', 'd1000000-0000-0000-0000-000000000005', 'c0000000-0000-0000-0000-000000000002', 0, now(), now()),
  ('e1000000-0000-0000-0000-000000000012', 'PRODUCT', 'Cle USB 4G', 'Cle Internet USB 4G pour ordinateur portable.', 'ACTIVE', 15000.00, 'XOF', 'd1000000-0000-0000-0000-000000000005', 'c0000000-0000-0000-0000-000000000002', 0, now(), now()),
  ('e1000000-0000-0000-0000-000000000013', 'PACK', 'Pack Decouverte', 'Carte SIM 4G + Forfait Data 5 Go + Forfait Voix 120 minutes.', 'ACTIVE', 5200.00, 'XOF', 'd1000000-0000-0000-0000-000000000004', 'c0000000-0000-0000-0000-000000000002', 0, now(), now()),
  ('e1000000-0000-0000-0000-000000000014', 'PACK', 'Pack Famille', 'Routeur 4G LTE + Forfait Data 50 Go, pour toute la maison.', 'ACTIVE', 48000.00, 'XOF', 'd1000000-0000-0000-0000-000000000004', 'c0000000-0000-0000-0000-000000000002', 0, now(), now())
ON CONFLICT (id) DO NOTHING;

-- Tables filles (heritage JOINED)
INSERT INTO services (id, service_type, characteristics, pack_only, billing_cycle) VALUES
  ('e1000000-0000-0000-0000-000000000001', 'DATA', '{"volume": "5 Go", "validite": "30 jours", "reseau": "4G/5G"}'::jsonb, false, 'MONTHLY'),
  ('e1000000-0000-0000-0000-000000000002', 'DATA', '{"volume": "15 Go", "validite": "30 jours", "reseau": "4G/5G"}'::jsonb, false, 'MONTHLY'),
  ('e1000000-0000-0000-0000-000000000003', 'DATA', '{"volume": "500 Mo", "validite": "24 heures"}'::jsonb, false, 'DAILY'),
  ('e1000000-0000-0000-0000-000000000004', 'DATA', '{"volume": "3 Go", "validite": "7 jours"}'::jsonb, false, 'WEEKLY'),
  ('e1000000-0000-0000-0000-000000000005', 'VOICE', '{"minutes": 120, "portee": "national"}'::jsonb, false, 'MONTHLY'),
  ('e1000000-0000-0000-0000-000000000006', 'VOICE', '{"minutes": 60, "portee": "international"}'::jsonb, false, 'MONTHLY'),
  ('e1000000-0000-0000-0000-000000000007', 'MOBILE_MONEY', '{"plafond_journalier": "1000000 XOF"}'::jsonb, false, 'ONE_TIME'),
  ('e1000000-0000-0000-0000-000000000008', 'MOBILE_MONEY', '{"commission": "1%"}'::jsonb, false, 'ONE_TIME'),
  ('e1000000-0000-0000-0000-000000000009', 'DATA', '{"volume": "50 Go", "validite": "30 jours"}'::jsonb, true, 'MONTHLY')
ON CONFLICT (id) DO NOTHING;

INSERT INTO products (id, characteristics, pack_only, quality_score) VALUES
  ('e1000000-0000-0000-0000-000000000010', '{"format": "triple-cut", "technologie": "4G/5G"}'::jsonb, false, 85.0),
  ('e1000000-0000-0000-0000-000000000011', '{"wifi": "802.11ac", "batterie": "3000 mAh"}'::jsonb, false, 72.0),
  ('e1000000-0000-0000-0000-000000000012', '{"interface": "USB 2.0", "debit_max": "150 Mbps"}'::jsonb, false, 64.0)
ON CONFLICT (id) DO NOTHING;

INSERT INTO packs (id, bundle_price, bundle_discount) VALUES
  ('e1000000-0000-0000-0000-000000000013', 5200.00, 800.00),
  ('e1000000-0000-0000-0000-000000000014', 48000.00, 7000.00)
ON CONFLICT (id) DO NOTHING;

-- ============================================================
-- 3. OFFRES (workflow complet : tous les statuts representes)
-- ============================================================
INSERT INTO offers (id, name, short_description, long_description, seo_title, seo_description, status, promotional_price, currency, valid_from, valid_until, target_segment, customer_type, quality_score, publish_date, legal_mentions, created_by_id, enriched_by_id, current_version, version, created_at, updated_at) VALUES
  ('f1000000-0000-0000-0000-000000000001', 'Promo Data 5 Go - Rentree', 'Forfait 5 Go a prix reduit pour la rentree.', 'Profitez de 5 Go d Internet mobile pendant 30 jours a tarif preferentiel dans le cadre de l operation Rentree Moov Africa.', 'Promo Data 5 Go Rentree | Moov Africa', 'Forfait 5 Go a 2500 FCFA pendant l operation Rentree.', 'PUBLISHED', 2500.00, 'XOF', now() - interval '20 days', now() + interval '40 days', 'PREPAID', 'INDIVIDUAL', 88.0, now() - interval '20 days', 'Offre valable du 1er au 30 du mois. Non cumulable avec d autres promotions.', 'c0000000-0000-0000-0000-000000000002', 'c0000000-0000-0000-0000-000000000003', 1, 0, now() - interval '25 days', now() - interval '20 days'),
  ('f1000000-0000-0000-0000-000000000002', 'Pack Decouverte Nouveaux Clients', 'SIM + Data + Voix pour bien demarrer.', 'Le Pack Decouverte reunit une carte SIM 4G, un forfait Data 5 Go et 120 minutes d appels nationaux.', 'Pack Decouverte | Moov Africa', 'Demarrez avec le Pack Decouverte Moov Africa.', 'PUBLISHED', 4500.00, 'XOF', now() - interval '45 days', now() + interval '90 days', 'PREPAID', 'INDIVIDUAL', 92.0, now() - interval '45 days', 'Reserve aux nouvelles activations de ligne.', 'c0000000-0000-0000-0000-000000000002', 'c0000000-0000-0000-0000-000000000003', 2, 0, now() - interval '50 days', now() - interval '45 days'),
  ('f1000000-0000-0000-0000-000000000003', 'Offre Entreprise Data 15 Go', 'Forfait 15 Go pour les professionnels.', 'Offre dediee aux entreprises : 15 Go mensuels avec support prioritaire et facturation groupee.', 'Offre Entreprise Data 15 Go | Moov Africa', 'Connectivite professionnelle 15 Go avec support dedie.', 'VALIDATED', 6500.00, 'XOF', now() + interval '10 days', now() + interval '190 days', 'POSTPAID', 'BUSINESS', 79.0, NULL, 'Engagement 12 mois. Facturation mensuelle.', 'c0000000-0000-0000-0000-000000000002', 'c0000000-0000-0000-0000-000000000003', 1, 0, now() - interval '12 days', now() - interval '3 days'),
  ('f1000000-0000-0000-0000-000000000004', 'Pass Weekend Illimite', 'Internet illimite du vendredi au dimanche.', 'Pass Internet a volume genereux utilisable du vendredi 18h au dimanche minuit.', 'Pass Weekend | Moov Africa', 'Surfez tout le week-end avec le Pass Weekend.', 'IN_VALIDATION', 1000.00, 'XOF', now() + interval '7 days', now() + interval '97 days', 'PREPAID', 'INDIVIDUAL', 68.0, NULL, 'Usage soumis a la politique d utilisation raisonnable.', 'c0000000-0000-0000-0000-000000000002', 'c0000000-0000-0000-0000-000000000003', 1, 0, now() - interval '8 days', now() - interval '2 days'),
  ('f1000000-0000-0000-0000-000000000005', 'Moov Money Zero Frais', 'Transferts sans frais le premier mois.', 'Tous les transferts nationaux Moov Money sont offerts pendant le premier mois suivant l inscription.', 'Moov Money Zero Frais | Moov Africa', 'Transferts gratuits pendant un mois avec Moov Money.', 'IN_ENRICHMENT', 0.00, 'XOF', now() + interval '15 days', now() + interval '75 days', 'HYBRID', 'ALL', 45.0, NULL, NULL, 'c0000000-0000-0000-0000-000000000002', NULL, 1, 0, now() - interval '5 days', now() - interval '1 day'),
  ('f1000000-0000-0000-0000-000000000006', 'Pack Famille Fibre Mobile', 'Routeur 4G et data pour la maison.', 'Le Pack Famille associe un routeur 4G LTE et un forfait data genereux pour connecter tout le foyer.', 'Pack Famille | Moov Africa', 'Connectez toute la famille avec le Pack Famille.', 'DRAFT', 45000.00, 'XOF', NULL, NULL, 'POSTPAID', 'INDIVIDUAL', 22.0, NULL, NULL, 'c0000000-0000-0000-0000-000000000002', NULL, 1, 0, now() - interval '2 days', now() - interval '2 days'),
  ('f1000000-0000-0000-0000-000000000007', 'Promo Voix International', 'Appels vers l Europe a tarif reduit.', 'Offre promotionnelle sur les appels internationaux vers l Europe et l Afrique de l Ouest.', 'Promo Voix International | Moov Africa', 'Appelez l international moins cher.', 'SUSPENDED', 4000.00, 'XOF', now() - interval '60 days', now() + interval '30 days', 'PREPAID', 'ALL', 71.0, now() - interval '60 days', 'Hors numeros speciaux et satellites.', 'c0000000-0000-0000-0000-000000000002', 'c0000000-0000-0000-0000-000000000003', 3, 0, now() - interval '70 days', now() - interval '10 days'),
  ('f1000000-0000-0000-0000-000000000008', 'Forfait Data 50 Go Illimite Nuit', 'Ancienne offre data haut volume.', 'Offre historique 50 Go avec navigation illimitee de minuit a 6h, retiree du catalogue.', 'Forfait 50 Go | Moov Africa', 'Ancienne offre 50 Go.', 'ARCHIVED', 18000.00, 'XOF', now() - interval '400 days', now() - interval '40 days', 'POSTPAID', 'INDIVIDUAL', 55.0, now() - interval '400 days', 'Offre cloturee.', 'c0000000-0000-0000-0000-000000000002', 'c0000000-0000-0000-0000-000000000003', 4, 0, now() - interval '410 days', now() - interval '40 days')
ON CONFLICT (id) DO NOTHING;

-- Liaison offres <-> items du catalogue
INSERT INTO offer_items (id, offer_id, catalog_item_id) VALUES
  ('81000000-0000-0000-0000-000000000001', 'f1000000-0000-0000-0000-000000000001', 'e1000000-0000-0000-0000-000000000001'),
  ('81000000-0000-0000-0000-000000000002', 'f1000000-0000-0000-0000-000000000002', 'e1000000-0000-0000-0000-000000000013'),
  ('81000000-0000-0000-0000-000000000003', 'f1000000-0000-0000-0000-000000000002', 'e1000000-0000-0000-0000-000000000010'),
  ('81000000-0000-0000-0000-000000000004', 'f1000000-0000-0000-0000-000000000003', 'e1000000-0000-0000-0000-000000000002'),
  ('81000000-0000-0000-0000-000000000005', 'f1000000-0000-0000-0000-000000000004', 'e1000000-0000-0000-0000-000000000004'),
  ('81000000-0000-0000-0000-000000000006', 'f1000000-0000-0000-0000-000000000005', 'e1000000-0000-0000-0000-000000000007'),
  ('81000000-0000-0000-0000-000000000007', 'f1000000-0000-0000-0000-000000000006', 'e1000000-0000-0000-0000-000000000014'),
  ('81000000-0000-0000-0000-000000000008', 'f1000000-0000-0000-0000-000000000007', 'e1000000-0000-0000-0000-000000000006'),
  ('81000000-0000-0000-0000-000000000009', 'f1000000-0000-0000-0000-000000000008', 'e1000000-0000-0000-0000-000000000009')
ON CONFLICT (id) DO NOTHING;

-- ============================================================
-- 4. CAMPAGNES MARKETING
-- ============================================================
INSERT INTO campaigns (id, name, offer_id, status, scheduled_at, published_at, created_by_id, created_at) VALUES
  ('11000000-0000-0000-0000-000000000001', 'Campagne Rentree Data', 'f1000000-0000-0000-0000-000000000001', 'PUBLISHED', now() - interval '20 days', now() - interval '20 days', 'c0000000-0000-0000-0000-000000000002', now() - interval '24 days'),
  ('11000000-0000-0000-0000-000000000002', 'Acquisition Nouveaux Clients', 'f1000000-0000-0000-0000-000000000002', 'PUBLISHED', now() - interval '45 days', now() - interval '45 days', 'c0000000-0000-0000-0000-000000000002', now() - interval '48 days'),
  ('11000000-0000-0000-0000-000000000003', 'Lancement Offre Entreprise', 'f1000000-0000-0000-0000-000000000003', 'SCHEDULED', now() + interval '10 days', NULL, 'c0000000-0000-0000-0000-000000000002', now() - interval '3 days'),
  ('11000000-0000-0000-0000-000000000004', 'Teasing Pass Weekend', 'f1000000-0000-0000-0000-000000000004', 'DRAFT', NULL, NULL, 'c0000000-0000-0000-0000-000000000002', now() - interval '2 days'),
  ('11000000-0000-0000-0000-000000000005', 'Retrospective Voix International', 'f1000000-0000-0000-0000-000000000007', 'COMPLETED', now() - interval '55 days', now() - interval '55 days', 'c0000000-0000-0000-0000-000000000002', now() - interval '60 days')
ON CONFLICT (id) DO NOTHING;

INSERT INTO campaign_channels (id, campaign_id, channel_type, message, status, sent_at) VALUES
  ('91000000-0000-0000-0000-000000000001', '11000000-0000-0000-0000-000000000001', 'SMS', 'Rentree Moov : 5 Go a 2500 F seulement ! Composez *123# pour souscrire.', 'SENT', now() - interval '20 days'),
  ('91000000-0000-0000-0000-000000000002', '11000000-0000-0000-0000-000000000001', 'FACEBOOK', 'La rentree est plus douce avec 5 Go a 2500 FCFA chez Moov Africa.', 'SENT', now() - interval '20 days'),
  ('91000000-0000-0000-0000-000000000003', '11000000-0000-0000-0000-000000000002', 'EMAIL', 'Bienvenue chez Moov Africa : decouvrez le Pack Decouverte a 4500 FCFA.', 'SENT', now() - interval '45 days'),
  ('91000000-0000-0000-0000-000000000004', '11000000-0000-0000-0000-000000000002', 'USSD', 'Pack Decouverte : SIM + 5 Go + 120 min. Tapez 1 pour souscrire.', 'SENT', now() - interval '45 days'),
  ('91000000-0000-0000-0000-000000000005', '11000000-0000-0000-0000-000000000003', 'LINKEDIN', 'Moov Africa Business : 15 Go et support dedie pour vos equipes.', 'PENDING', NULL),
  ('91000000-0000-0000-0000-000000000006', '11000000-0000-0000-0000-000000000003', 'EMAIL', 'Votre connectivite professionnelle evolue avec Moov Africa Business.', 'PENDING', NULL),
  ('91000000-0000-0000-0000-000000000007', '11000000-0000-0000-0000-000000000004', 'PUSH_NOTIFICATION', 'Bientot : surfez tout le week-end pour 1000 FCFA.', 'PENDING', NULL),
  ('91000000-0000-0000-0000-000000000008', '11000000-0000-0000-0000-000000000005', 'SMS', 'Appelez l Europe moins cher avec Moov Africa.', 'SENT', now() - interval '55 days')
ON CONFLICT (id) DO NOTHING;

-- ============================================================
-- 5. REGLES METIER
-- ============================================================
INSERT INTO business_rules (id, name, rule_type, source_item_id, target_item_id, description, active, created_by_id, created_at) VALUES
  ('21000000-0000-0000-0000-000000000001', 'SIM obligatoire avec forfait Data', 'MANDATORY_COMPOSITION', 'e1000000-0000-0000-0000-000000000001', 'e1000000-0000-0000-0000-000000000010', 'Toute souscription a un forfait Data pour un nouveau client impose la fourniture d une carte SIM 4G.', true, 'c0000000-0000-0000-0000-000000000002', now() - interval '30 days'),
  ('21000000-0000-0000-0000-000000000002', 'Incompatibilite Pass journalier et Forfait mensuel', 'INCOMPATIBILITY', 'e1000000-0000-0000-0000-000000000003', 'e1000000-0000-0000-0000-000000000002', 'Un Pass Internet journalier ne peut pas etre cumule avec un forfait Data mensuel actif.', true, 'c0000000-0000-0000-0000-000000000002', now() - interval '28 days'),
  ('21000000-0000-0000-0000-000000000003', 'Compatibilite Routeur et Forfait 15 Go', 'COMPATIBILITY', 'e1000000-0000-0000-0000-000000000011', 'e1000000-0000-0000-0000-000000000002', 'Le routeur 4G LTE est compatible avec le forfait Data 15 Go.', true, 'c0000000-0000-0000-0000-000000000002', now() - interval '25 days'),
  ('21000000-0000-0000-0000-000000000004', 'Forfait 50 Go reserve aux packs', 'PACK_ONLY', 'e1000000-0000-0000-0000-000000000009', 'e1000000-0000-0000-0000-000000000014', 'Le forfait Data 50 Go n est commercialisable qu au sein du Pack Famille.', true, 'c0000000-0000-0000-0000-000000000002', now() - interval '20 days'),
  ('21000000-0000-0000-0000-000000000005', 'Ancienne regle Voix International', 'COMPATIBILITY', 'e1000000-0000-0000-0000-000000000006', 'e1000000-0000-0000-0000-000000000005', 'Regle historique desactivee lors de la refonte du catalogue Voix.', false, 'c0000000-0000-0000-0000-000000000002', now() - interval '90 days')
ON CONFLICT (id) DO NOTHING;

-- ============================================================
-- 6. TESTS A/B
-- ============================================================
INSERT INTO ab_tests (id, offer_id, variant_a, variant_b, metric, status, winner, created_by_id, created_at) VALUES
  ('31000000-0000-0000-0000-000000000001', 'f1000000-0000-0000-0000-000000000001', 'Rentree Moov : 5 Go a 2500 F seulement !', 'Offre speciale rentree : 5 Go pour 2500 FCFA', 'CONVERSION_RATE', 'COMPLETED', 'A', 'c0000000-0000-0000-0000-000000000002', now() - interval '22 days'),
  ('31000000-0000-0000-0000-000000000002', 'f1000000-0000-0000-0000-000000000002', 'Demarrez avec le Pack Decouverte', 'Nouveau chez Moov ? Le Pack Decouverte est fait pour vous', 'CLICK_THROUGH_RATE', 'RUNNING', NULL, 'c0000000-0000-0000-0000-000000000002', now() - interval '6 days'),
  ('31000000-0000-0000-0000-000000000003', 'f1000000-0000-0000-0000-000000000004', 'Pass Weekend : surfez sans compter', 'Tout le week-end pour 1000 FCFA', 'SUBSCRIPTION_COUNT', 'DRAFT', NULL, 'c0000000-0000-0000-0000-000000000002', now() - interval '1 day')
ON CONFLICT (id) DO NOTHING;

-- ============================================================
-- 7. EXPORTS VERS SYSTEMES TIERS
-- ============================================================
INSERT INTO integration_exports (id, target_system, offer_id, export_type, status, idempotency_key, payload, error_message, retry_count, created_at, completed_at) VALUES
  ('41000000-0000-0000-0000-000000000001', 'CRM', 'f1000000-0000-0000-0000-000000000001', 'AUTO_PUBLISH', 'SUCCESS', 'seed-export-crm-001', '{"offerName": "Promo Data 5 Go - Rentree"}'::jsonb, NULL, 0, now() - interval '20 days', now() - interval '20 days'),
  ('41000000-0000-0000-0000-000000000002', 'WEBSITE', 'f1000000-0000-0000-0000-000000000001', 'AUTO_PUBLISH', 'SUCCESS', 'seed-export-web-001', '{"offerName": "Promo Data 5 Go - Rentree"}'::jsonb, NULL, 0, now() - interval '20 days', now() - interval '20 days'),
  ('41000000-0000-0000-0000-000000000003', 'CALL_CENTER', 'f1000000-0000-0000-0000-000000000002', 'MANUAL_EXPORT', 'SUCCESS', 'seed-export-cc-001', '{"offerName": "Pack Decouverte Nouveaux Clients"}'::jsonb, NULL, 0, now() - interval '44 days', now() - interval '44 days'),
  ('41000000-0000-0000-0000-000000000004', 'CRM', 'f1000000-0000-0000-0000-000000000007', 'RESYNC', 'FAILED', 'seed-export-crm-002', '{"offerName": "Promo Voix International"}'::jsonb, 'Delai d attente depasse lors de l appel au CRM (timeout 30s).', 2, now() - interval '10 days', NULL),
  ('41000000-0000-0000-0000-000000000005', 'WEBSITE', 'f1000000-0000-0000-0000-000000000003', 'MANUAL_EXPORT', 'PENDING', 'seed-export-web-002', '{"offerName": "Offre Entreprise Data 15 Go"}'::jsonb, NULL, 0, now() - interval '2 days', NULL),
  ('41000000-0000-0000-0000-000000000006', 'CRM', 'f1000000-0000-0000-0000-000000000003', 'CATALOG_EXPORT', 'PENDING', 'seed-export-crm-003', '{"offerName": "Offre Entreprise Data 15 Go"}'::jsonb, NULL, 1, now() - interval '1 day', NULL)
ON CONFLICT (id) DO NOTHING;

-- ============================================================
-- 8. NOTIFICATIONS (destinataire : alpha)
-- ============================================================
INSERT INTO notifications (id, recipient_id, type, title, message, read, related_offer_id, created_at) VALUES
  ('51000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000002', 'VALIDATION_REQUIRED', 'Validation requise : Pass Weekend Illimite', 'L offre Pass Weekend Illimite attend votre validation avant publication.', false, 'f1000000-0000-0000-0000-000000000004', now() - interval '2 days'),
  ('51000000-0000-0000-0000-000000000002', 'c0000000-0000-0000-0000-000000000002', 'ENRICHMENT_REQUIRED', 'Enrichissement requis : Moov Money Zero Frais', 'Cette offre est incomplete : mentions legales et visuels manquants.', false, 'f1000000-0000-0000-0000-000000000005', now() - interval '1 day'),
  ('51000000-0000-0000-0000-000000000003', 'c0000000-0000-0000-0000-000000000002', 'STATUS_PUBLISHED', 'Offre publiee : Promo Data 5 Go - Rentree', 'L offre a ete publiee avec succes sur l ensemble des canaux.', true, 'f1000000-0000-0000-0000-000000000001', now() - interval '20 days'),
  ('51000000-0000-0000-0000-000000000004', 'c0000000-0000-0000-0000-000000000002', 'OFFER_EXPIRING', 'Expiration proche : Promo Voix International', 'Cette offre arrive a echeance dans 30 jours.', false, 'f1000000-0000-0000-0000-000000000007', now() - interval '5 hours'),
  ('51000000-0000-0000-0000-000000000005', 'c0000000-0000-0000-0000-000000000002', 'CAMPAIGN_READY', 'Campagne prete : Lancement Offre Entreprise', 'La campagne est programmee et prete a etre diffusee.', false, 'f1000000-0000-0000-0000-000000000003', now() - interval '3 hours'),
  ('51000000-0000-0000-0000-000000000006', 'c0000000-0000-0000-0000-000000000002', 'STRATEGIC_VALIDATION', 'Validation strategique : Offre Entreprise Data 15 Go', 'Cette offre a un impact revenu significatif et requiert une validation de direction.', true, 'f1000000-0000-0000-0000-000000000003', now() - interval '4 days'),
  ('51000000-0000-0000-0000-000000000007', 'c0000000-0000-0000-0000-000000000002', 'OFFER_REJECTED', 'Offre rejetee : Pack Famille Fibre Mobile', 'Le dossier est incomplet : prix promotionnel et periode de validite manquants.', false, 'f1000000-0000-0000-0000-000000000006', now() - interval '1 hour')
ON CONFLICT (id) DO NOTHING;

-- ============================================================
-- 9. EVENEMENTS KPI (alimente la page Analytics sur ~90 jours)
-- ============================================================
INSERT INTO kpi_events (id, offer_id, event_type, actor_id, duration_ms, created_at)
SELECT
  ('61000000-0000-0000-0000-' || lpad(gs::text, 12, '0'))::uuid,
  (ARRAY[
    'f1000000-0000-0000-0000-000000000001',
    'f1000000-0000-0000-0000-000000000002',
    'f1000000-0000-0000-0000-000000000003',
    'f1000000-0000-0000-0000-000000000004',
    'f1000000-0000-0000-0000-000000000007'
  ]::uuid[])[1 + (gs % 5)],
  (ARRAY['OFFER_CREATED','STATUS_IN_ENRICHMENT','STATUS_VALIDATED','STATUS_PUBLISHED','TIME_TO_MARKET','CAMPAIGN_SENT'])[1 + (gs % 6)],
  (ARRAY[
    'c0000000-0000-0000-0000-000000000002',
    'c0000000-0000-0000-0000-000000000003'
  ]::uuid[])[1 + (gs % 2)],
  (30000 + (gs * 7919) % 900000)::bigint,
  now() - ((gs * 37) % 90 || ' days')::interval - ((gs * 13) % 24 || ' hours')::interval
FROM generate_series(1, 60) AS gs
ON CONFLICT (id) DO NOTHING;

-- ============================================================
-- 10. JOURNAL D AUDIT
-- ============================================================
INSERT INTO audit_logs (id, user_id, action, entity_type, entity_id, previous_value, new_value, ip_address, created_at, user_agent)
SELECT
  ('71000000-0000-0000-0000-' || lpad(gs::text, 12, '0'))::uuid,
  (ARRAY[
    'c0000000-0000-0000-0000-000000000002',
    'c0000000-0000-0000-0000-000000000003'
  ]::uuid[])[1 + (gs % 2)],
  (ARRAY['CREATE','UPDATE','DELETE','PUBLISH','VALIDATE','LOGIN'])[1 + (gs % 6)],
  (ARRAY['Offer','CatalogItem','Campaign','BusinessRule','User'])[1 + (gs % 5)],
  (ARRAY[
    'f1000000-0000-0000-0000-000000000001',
    'e1000000-0000-0000-0000-000000000001',
    '11000000-0000-0000-0000-000000000001',
    '21000000-0000-0000-0000-000000000001',
    'c0000000-0000-0000-0000-000000000002'
  ]::uuid[])[1 + (gs % 5)],
  NULL,
  ('{"seed": true, "sequence": ' || gs || '}')::jsonb,
  '10.20.30.' || (1 + (gs % 200)),
  now() - ((gs * 29) % 60 || ' days')::interval - ((gs * 17) % 24 || ' hours')::interval,
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0 Safari/537.36'
FROM generate_series(1, 45) AS gs
ON CONFLICT (id) DO NOTHING;
