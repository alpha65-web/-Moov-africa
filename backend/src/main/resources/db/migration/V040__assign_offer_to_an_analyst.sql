-- Designation de l'analyste marketing charge d'enrichir une offre.
--
-- Le circuit ne disait pas qui, parmi plusieurs analystes, devait traiter une
-- fiche donnee. La colonne enriched_by_id existait deja mais elle est ecrite
-- *pendant* l'enrichissement : c'est une trace de qui l'a fait, pas une
-- designation de qui doit le faire. En consequence, la notification
-- « Enrichissement requis » partait vers tous les detenteurs de OFFER_ENRICH, et
-- le premier arrive traitait la fiche. Avec deux analystes en base, le travail
-- pouvait etre fait deux fois et personne n'etait identifiable comme responsable.
--
-- L'affectation est volontairement independante du circuit de statuts : aucun
-- statut n'est ajoute, la colonne se renseigne a tout moment sans retarder le
-- passage en enrichissement.
ALTER TABLE offers ADD COLUMN IF NOT EXISTS assigned_to_id UUID;

COMMENT ON COLUMN offers.assigned_to_id IS
    'Analyste marketing designe pour l''enrichissement. Nul tant que l''offre n''est pas repartie.';

-- Index : l'ecran de l'analyste ouvre sur les fiches qui lui sont confiees.
CREATE INDEX IF NOT EXISTS idx_offers_assigned_to ON offers (assigned_to_id);

-- Repartir le travail est un acte d'encadrement, distinct de la validation.
-- Une permission dediee permet de le confier plus tard a un autre role sans
-- toucher au code, conformement a la demande du cahier des charges de traiter
-- les permissions comme des donnees configurables.
INSERT INTO permissions (id, code, description) VALUES
    ('b0000000-0000-0000-0000-000000000019', 'OFFER_ASSIGN', 'Affecter une offre a un analyste marketing pour enrichissement')
ON CONFLICT (code) DO NOTHING;

-- Le chef de service : il encadre les analystes, valide ensuite leur travail, et
-- dispose de la vue transversale sur plusieurs chefs de produit que lui donne le
-- cahier des charges. L'administration l'obtient pour pouvoir depanner.
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r, permissions p
WHERE r.name IN ('CHEF_SERVICE', 'ADMIN_SYSTEME', 'SUPER_ADMIN')
  AND p.code = 'OFFER_ASSIGN'
ON CONFLICT DO NOTHING;
