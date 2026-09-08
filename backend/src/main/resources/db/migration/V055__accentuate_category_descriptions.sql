-- Accentuation des descriptions de categories.
--
-- La nomenclature (V045) a ete saisie sans accents : « Acces Internet a
-- domicile », « reseau », « validite mensuelle ». Ces libelles s'affichent tels
-- quels dans l'ecran Categories et dans le classement des fiches. Ils sont
-- corriges par identifiant, sans toucher aux categories creees depuis l'ecran.

UPDATE categories SET description = 'Accès Internet à domicile et en entreprise'   WHERE id = 'd2000000-0000-0000-0000-000000000025';
UPDATE categories SET description = 'Offres Internet sur le réseau mobile'           WHERE id = 'd2000000-0000-0000-0000-000000000011';
UPDATE categories SET description = 'Offres combinées multi-services'                WHERE id = 'd1000000-0000-0000-0000-000000000004';
UPDATE categories SET description = 'Offres et services destinés aux entreprises'   WHERE id = 'd2000000-0000-0000-0000-000000000029';
UPDATE categories SET description = 'Forfaits Internet à validité mensuelle'         WHERE id = 'd1000000-0000-0000-0000-000000000011';
UPDATE categories SET description = 'Modems et clés Internet'                        WHERE id = 'd2000000-0000-0000-0000-000000000004';
UPDATE categories SET description = 'Porte-monnaie électronique Moov Money'          WHERE id = 'd2000000-0000-0000-0000-000000000022';
UPDATE categories SET description = 'Pass Internet de courte durée'                  WHERE id = 'd1000000-0000-0000-0000-000000000012';
UPDATE categories SET description = 'Envoi et réception d''argent'                   WHERE id = 'd2000000-0000-0000-0000-000000000023';
UPDATE categories SET description = 'Offres à facturation différée'                  WHERE name = 'Offres postpayées' AND description = 'Offres a facturation differee';
UPDATE categories SET description = 'Offres à paiement anticipé'                     WHERE name = 'Offres prépayées'  AND description = 'Offres a paiement anticipe';
