-- Retrait de deux vestiges jamais alimentes, pour qu'aucun chiffre non calcule
-- ne subsiste dans le schema.
--
-- 1. products.quality_score : contrairement au score des offres (calcule a chaque
--    modification a partir de la completude), le score des produits du referentiel
--    n'a jamais ete calcule. Il valait 0 pour toutes les lignes et n'etait affiche
--    nulle part. La colonne est retiree plutot que laissee a zero.
--
-- 2. campaign_stats : table de vues / clics / engagement jamais renseignee. Ces
--    metriques supposeraient un raccordement aux interfaces des reseaux sociaux,
--    dont la plateforme ne dispose pas ; l'ecran des campagnes ne les affiche
--    volontairement pas. La table vide est donc supprimee.

ALTER TABLE products DROP COLUMN IF EXISTS quality_score;

DROP TABLE IF EXISTS campaign_stats;
