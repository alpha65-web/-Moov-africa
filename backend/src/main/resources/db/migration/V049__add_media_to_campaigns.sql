-- Visuel accompagnant une campagne de diffusion.
--
-- Le community manager prepare des campagnes vers les reseaux sociaux et les
-- sites partenaires (cahier des charges l. 107 et 183) sans qu'aucun visuel
-- n'apparaisse nulle part sur son ecran : ni l'entite Campaign ni la table ne
-- portaient de media. Il programmait donc une publication Facebook ou Instagram
-- sans voir l'image qui habille l'offre qu'il diffuse.
--
-- La colonne ne lui donne pas le droit de deposer un visuel : le depot et
-- l'association restent la charge de l'analyste marketing (l. 104 et 154), et
-- tout visuel doit d'abord franchir la validation graphique du chef de service
-- (l. 158) avant que l'offre parte en validation metier. Elle lui permet de
-- DESIGNER, parmi les visuels deja rattaches a l'offre et deja approuves,
-- celui qui accompagne sa diffusion.
--
-- Nullable : une campagne purement textuelle — SMS, USSD — n'a pas de visuel,
-- et les campagnes deja enregistrees n'en ont aucun.
--
-- ON DELETE SET NULL : si le visuel disparait de la mediatheque, la campagne
-- doit survivre sans son image plutot que d'etre supprimee avec elle. Une
-- campagne deja diffusee est une trace, elle ne s'efface pas parce qu'un
-- fichier a ete nettoye.
ALTER TABLE campaigns
    ADD COLUMN media_asset_id UUID REFERENCES media_assets(id) ON DELETE SET NULL;

CREATE INDEX idx_campaigns_media ON campaigns(media_asset_id);
