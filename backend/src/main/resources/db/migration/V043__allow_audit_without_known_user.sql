-- Journaliser une tentative de connexion sur un compte inconnu.
--
-- audit_logs.user_id etait NOT NULL. Or une tentative de connexion avec une
-- adresse qui ne correspond a aucun compte n'a, par definition, pas
-- d'utilisateur : l'insertion echouait donc sur une violation de contrainte, et
-- l'evenement n'etait jamais enregistre.
--
-- Constate en faisant tourner l'application : un appel a /auth/login avec une
-- adresse inexistante renvoie bien 401, mais produit en arriere-plan une
-- DataIntegrityViolationException dans AuditEventListener, et la tentative
-- disparait. C'est precisement la tentative la plus interessante a conserver :
-- une serie d'echecs sur des adresses inconnues est la signature d'une
-- enumeration de comptes, que le journal doit permettre de reperer.
--
-- entity_id est relachee pour la meme raison. Le code contournait la contrainte
-- en ecrivant l'UUID nul (00000000-...), un identifiant qui ne designe rien et
-- qui se serait retrouve dans les exports d'audit comme s'il s'agissait d'une
-- vraie reference.
--
-- La cle etrangere vers users est conservee : une valeur nulle la satisfait, et
-- un identifiant renseigne doit toujours designer un compte existant.
ALTER TABLE audit_logs ALTER COLUMN user_id   DROP NOT NULL;
ALTER TABLE audit_logs ALTER COLUMN entity_id DROP NOT NULL;

COMMENT ON COLUMN audit_logs.user_id IS
    'Auteur de l''action. Nul lorsque l''action n''a pas d''auteur identifie — '
    'typiquement une tentative de connexion sur une adresse inconnue.';

COMMENT ON COLUMN audit_logs.entity_id IS
    'Objet de l''action. Nul lorsque l''action ne porte sur aucun objet existant.';

-- Les lignes deja ecrites avec l'UUID nul en guise d'identifiant d'entite sont
-- ramenees a NULL : elles designaient une entite inexistante.
UPDATE audit_logs
SET entity_id = NULL
WHERE entity_id = '00000000-0000-0000-0000-000000000000';
