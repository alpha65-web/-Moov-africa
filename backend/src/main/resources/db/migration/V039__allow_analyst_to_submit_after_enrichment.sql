-- Permet a l'analyste marketing de rendre la main apres avoir enrichi la fiche.
--
-- Le circuit du cahier des charges (l. 145-146) enchaine : le chef de produit
-- cree, « l'analyste marketing enrichit la meme fiche », puis « le chef de
-- service valide ou rejette ». Le passage En enrichissement -> En validation
-- appartient donc a l'analyste, puisque c'est lui qui termine cette etape.
--
-- Or ce passage exige OFFER_SUBMIT, que seul le chef de produit detenait.
-- Verifie en conditions reelles sur l'application lancee : apres enrichissement,
-- l'analyste restait bloque et le chef de produit devait revenir soumettre a sa
-- place, ce que le circuit ne prevoit pas. Effet de bord constate au meme
-- moment : l'analyste ne realisant aucune transition, son temps de traitement
-- individuel — l'indicateur que la section 7.9 lui reserve — etait vide par
-- construction.
--
-- La separation des taches n'est pas affaiblie : OFFER_SUBMIT ne donne ni la
-- validation (OFFER_VALIDATE) ni la publication (OFFER_PUBLISH), et
-- OfferService.permissionsFor continue de refuser ces transitions a l'analyste.
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r, permissions p
WHERE r.name = 'ANALYSTE_MARKETING'
  AND p.code = 'OFFER_SUBMIT'
ON CONFLICT DO NOTHING;
