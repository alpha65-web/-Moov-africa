-- Distinction entre une regle qui bloque et une regle qui avertit.
--
-- La section 7.3 du cahier des charges impose que « le systeme doit bloquer ou
-- avertir *avant* la soumission ». Les deux comportements etaient donc prevus,
-- mais rien en base ne permettait de choisir : business_rules ne portait que
-- active, sans indiquer la severite de la contrainte.
--
-- Sans ce drapeau, toute nouvelle regle serait bloquante des sa creation, ce qui
-- interdit d'introduire progressivement une contrainte sur un catalogue deja
-- constitue : les offres existantes qui la violent deviendraient immediatement
-- insoumissibles.
--
-- Valeur par defaut bloquante : une regle metier declaree est une contrainte, et
-- c'est a son auteur de la relacher explicitement s'il veut seulement avertir.
ALTER TABLE business_rules
    ADD COLUMN IF NOT EXISTS blocking BOOLEAN NOT NULL DEFAULT true;

COMMENT ON COLUMN business_rules.blocking IS
    'true : la violation empeche l''enregistrement et la soumission de l''offre. '
    'false : la violation est signalee mais n''empeche rien.';
