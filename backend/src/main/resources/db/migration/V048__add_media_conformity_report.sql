-- Constat d'inspection d'un media depose.
--
-- Les colonnes width, height et resolution existent depuis la migration V006
-- mais n'ont jamais ete ecrites : aucun appelant de setWidth, setHeight,
-- setResolution ni setCopyrightRisk n'existait dans le depot. Tout media valait
-- donc 0 x 0, aucun risque de droits n'etait signale, et le chef de service
-- devait juger « le format, la resolution et les droits d'auteur » d'un visuel
-- (cahier des charges 7.6) sans qu'aucun des trois ne lui soit presente.
--
-- Ces deux colonnes portent le resultat de l'inspection en clair. Le rapport est
-- stocke plutot que recalcule a l'affichage : il decrit le fichier tel qu'il a
-- ete recu, et doit rester lisible a l'identique meme si les seuils de la
-- plateforme changent par la suite.
ALTER TABLE media_assets ADD COLUMN conformity_report TEXT;
ALTER TABLE media_assets ADD COLUMN copyright_notice  VARCHAR(255);

-- Les medias deja deposes n'ont pas ete inspectes : le dire explicitement vaut
-- mieux que de laisser un rapport vide passer pour un rapport vierge.
UPDATE media_assets
   SET conformity_report = 'Média déposé avant la mise en place de l''inspection automatique : ni sa résolution ni ses mentions de droits n''ont été mesurées.'
 WHERE conformity_report IS NULL;
