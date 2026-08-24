-- Repartition du jeu de demonstration entre les roles metier.
--
-- Tout le contenu de demonstration etait attribue au compte administrateur.
-- Combine au perimetre de visibilite du chef de produit, qui ne voit que ses
-- propres fiches (regle imposee par le cahier des charges), cela rendait ses
-- ecrans Catalogue et Offres definitivement vides : il n'etait proprietaire de
-- rien. La paternite est donc confiee au role qui, dans le processus reel,
-- produit chaque type de contenu.
--
-- L'administrateur conserve la vue globale : hasTransversalScope() lui donne
-- acces a l'ensemble des fiches quel qu'en soit l'auteur.

-- Catalogue, offres, regles metier et tests A/B : le chef de produit
-- (CATALOG_MANAGE, RULE_MANAGE, OFFER_CREATE, OFFER_SUBMIT).
UPDATE catalog_items  SET created_by_id = 'c0000000-0000-0000-0000-000000000011'
WHERE created_by_id = 'c0000000-0000-0000-0000-000000000002';

UPDATE offers         SET created_by_id = 'c0000000-0000-0000-0000-000000000011'
WHERE created_by_id = 'c0000000-0000-0000-0000-000000000002';

UPDATE business_rules SET created_by_id = 'c0000000-0000-0000-0000-000000000011'
WHERE created_by_id = 'c0000000-0000-0000-0000-000000000002';

UPDATE ab_tests       SET created_by_id = 'c0000000-0000-0000-0000-000000000011'
WHERE created_by_id = 'c0000000-0000-0000-0000-000000000002';

-- Campagnes : le community manager (CAMPAIGN_MANAGE).
UPDATE campaigns      SET created_by_id = 'c0000000-0000-0000-0000-000000000014'
WHERE created_by_id = 'c0000000-0000-0000-0000-000000000002';

-- Medias : l'analyste marketing (MEDIA_UPLOAD), qui produit les visuels soumis
-- au circuit de validation graphique du chef de service.
UPDATE media_assets   SET uploaded_by_id = 'c0000000-0000-0000-0000-000000000015'
WHERE uploaded_by_id = 'c0000000-0000-0000-0000-000000000002';

-- Historique de cycle de vie : rattache a l'auteur des offres, pour que les
-- fiches et leur historique designent le meme acteur.
UPDATE offer_status_history SET changed_by_id = 'c0000000-0000-0000-0000-000000000011'
WHERE changed_by_id = 'c0000000-0000-0000-0000-000000000002';

UPDATE offer_versions       SET changed_by_id = 'c0000000-0000-0000-0000-000000000011'
WHERE changed_by_id = 'c0000000-0000-0000-0000-000000000002';
