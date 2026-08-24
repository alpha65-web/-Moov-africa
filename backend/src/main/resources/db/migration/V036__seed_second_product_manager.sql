-- Second chef de produit, pour rendre le cloisonnement demontrable a l'ecran.
--
-- Le cahier des charges impose qu'« un chef de produit ne voit que les offres qu'il
-- a lui-meme creees, jamais celles des autres chefs de produit », et que « le chef
-- de service a une vue transversale ». Avec un seul titulaire du role, la regle
-- s'applique mais ne se voit pas : il faut deux comptes et deux offres distinctes
-- pour la montrer.
--
-- Mot de passe : MoovProduit2@2026! (hash BCrypt cost 12, comme V032).

INSERT INTO users (id, email, password_hash, first_name, last_name, role_id, status,
                   failed_login_attempts, force_password_change)
VALUES ('c0000000-0000-0000-0000-000000000016', 'chef.produit2@moov-africa.bf',
        '$2b$12$bBc2v7HmK4FkHWclxgC0MOJ7Uw22GmqC.z1Q4amceVrzruhBegTM6',
        'Chef', 'Produit 2', 'a0000000-0000-0000-0000-000000000002', 'ACTIVE', 0, false)
ON CONFLICT DO NOTHING;

-- Deux offres lui appartenant, a des etapes differentes du circuit : l'une en
-- brouillon, l'autre soumise a validation. Le chef de service doit voir les deux,
-- le premier chef de produit aucune.
INSERT INTO offers (id, name, short_description, long_description, status,
                    promotional_price, currency, target_segment, customer_type,
                    quality_score, created_by_id, created_at, updated_at)
VALUES
  ('f1000000-0000-0000-0000-000000000021', 'Forfait Data Nuit 10 Go',
   'Volume nocturne dedie, de minuit a six heures.',
   'Forfait Internet mobile de 10 Go utilisables entre minuit et six heures du matin, valable 30 jours.',
   'DRAFT', 4000.00, 'XOF', 'PREPAID', 'INDIVIDUAL', 35.0,
   'c0000000-0000-0000-0000-000000000016', now() - interval '4 days', now() - interval '4 days'),

  ('f1000000-0000-0000-0000-000000000022', 'Pack Etudiant Connecte',
   'SIM, data et minutes a tarif etudiant.',
   'Offre reservee aux etudiants sur presentation d une carte : carte SIM, 8 Go de data et 60 minutes d appels nationaux.',
   'IN_VALIDATION', 3500.00, 'XOF', 'PREPAID', 'INDIVIDUAL', 74.0,
   'c0000000-0000-0000-0000-000000000016', now() - interval '9 days', now() - interval '2 days')
ON CONFLICT DO NOTHING;

-- Le circuit prevoit qu'une offre soumise attende le chef de service : la
-- notification correspondante est posee pour que l'ecran soit coherent des la
-- premiere connexion, sans qu'il faille rejouer une transition.
INSERT INTO notifications (id, recipient_id, type, title, message, read, related_offer_id, created_at)
SELECT '52000000-0000-0000-0000-000000000021', u.id, 'VALIDATION_REQUIRED',
       'Validation requise',
       'L offre « Pack Etudiant Connecte » est soumise et attend votre validation operationnelle.',
       false, 'f1000000-0000-0000-0000-000000000022', now() - interval '2 days'
FROM users u JOIN roles r ON r.id = u.role_id
WHERE r.name = 'CHEF_SERVICE'
ON CONFLICT DO NOTHING;
