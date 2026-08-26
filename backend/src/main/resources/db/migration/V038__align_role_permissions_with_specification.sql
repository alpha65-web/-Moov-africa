-- Aligne les permissions sur la repartition des taches du cahier des charges.
--
-- Trois ecarts constates entre regles/PROMPT_MAITRE (section 6, tableau des roles)
-- et les permissions reellement accordees en base :
--
--   1. Les tests A/B sont attribues a l'analyste marketing (l. 104), mais les
--      ecritures de AbTestController exigent CATALOG_WRITE, accordee par la V017
--      au seul administrateur et au chef de produit. L'analyste ne pouvait donc
--      pas faire ce qui releve explicitement de son role.
--
--   2. ANALYTICS_VIEW etait tout ou rien et n'etait accordee qu'au chef de
--      departement. Le cahier des charges (l. 170) prevoit pourtant deux
--      perimetres distincts : la productivite des equipes d'un cote, le temps de
--      traitement individuel de l'analyste marketing de l'autre. Sans separation,
--      ouvrir l'ecran a l'analyste lui aurait donne la vue strategique complete.
--
--   3. Le chef de service doit voir la productivite des equipes et les KPI au
--      meme titre que le chef de departement. C'est un arbitrage explicite qui
--      etend le cahier des charges, lequel reservait cette vue au seul chef de
--      departement.

-- Nouvelle permission : le perimetre transversal des indicateurs.
-- ANALYTICS_VIEW conserve son sens d'origine (acceder a l'ecran) ; c'est
-- ANALYTICS_TEAM_VIEW qui ouvre les chiffres de toute l'equipe. Un titulaire de
-- ANALYTICS_VIEW sans TEAM_VIEW ne voit que son propre temps de traitement.
INSERT INTO permissions (id, code, description) VALUES
    ('b0000000-0000-0000-0000-000000000018', 'ANALYTICS_TEAM_VIEW', 'Consulter les indicateurs de toute l''equipe (Time To Market, productivite par etape)')
ON CONFLICT (code) DO NOTHING;

-- Vue transversale : administration, chef de departement et chef de service.
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r, permissions p
WHERE r.name IN ('ADMIN_SYSTEME', 'SUPER_ADMIN', 'CHEF_DEPARTEMENT', 'CHEF_SERVICE')
  AND p.code = 'ANALYTICS_TEAM_VIEW'
ON CONFLICT DO NOTHING;

-- Acces a l'ecran : le chef de service (vue equipe) et l'analyste marketing
-- (vue individuelle) le rejoignent.
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r, permissions p
WHERE r.name IN ('CHEF_SERVICE', 'ANALYSTE_MARKETING')
  AND p.code = 'ANALYTICS_VIEW'
ON CONFLICT DO NOTHING;

-- Tests A/B : rattaches a l'analyste marketing, conformement au cahier des charges.
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r, permissions p
WHERE r.name = 'ANALYSTE_MARKETING'
  AND p.code = 'CATALOG_WRITE'
ON CONFLICT DO NOTHING;

-- Retrait symetrique : les tests A/B quittent le chef de produit.
--
-- La V017 lui avait accorde CATALOG_WRITE pour « modifier les elements du
-- catalogue et gerer les tests A/B », alors que le cahier des charges attribue
-- les tests A/B a l'analyste marketing. Le laisser des deux cotes reviendrait a
-- afficher chez le chef de produit un ecran qui ne releve pas de son role.
--
-- Ses autres capacites ne sont pas touchees : CATALOG_MANAGE couvre deja la
-- creation et la modification des produits, services et packs. MEDIA_UPLOAD lui
-- reste egalement, car la section 7.10 place les fiches techniques produit de son
-- cote ; seule l'association des visuels a l'offre releve de l'analyste.
DELETE FROM role_permissions
WHERE role_id = (SELECT id FROM roles WHERE name = 'CHEF_PRODUIT')
  AND permission_id = (SELECT id FROM permissions WHERE code = 'CATALOG_WRITE');
