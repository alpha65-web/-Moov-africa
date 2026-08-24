-- Profils des comptes livres : sexe, telephone et pseudo.
--
-- L'ecran Utilisateurs comporte une colonne Sexe, la fiche de detail affiche
-- telephone et pseudo, et le formulaire de creation permet de les saisir. Mais
-- aucun compte livre ne portait ces valeurs : les colonnes restaient vides sur
-- toutes les lignes, ce qui donnait a penser que l'affichage etait casse alors
-- que c'est la donnee qui manquait.
--
-- Les numeros suivent le plan burkinabe : indicatif +226 et huit chiffres.

UPDATE users SET sex = 'F', phone = '+22670110201', pseudo = 'alpha'
WHERE email = 'alpha@moov-africa.bf' AND sex IS NULL;

UPDATE users SET sex = 'M', phone = '+22670110202', pseudo = 'cproduit'
WHERE email = 'chef.produit@moov-africa.bf' AND sex IS NULL;

UPDATE users SET sex = 'F', phone = '+22670110203', pseudo = 'cproduit2'
WHERE email = 'chef.produit2@moov-africa.bf' AND sex IS NULL;

UPDATE users SET sex = 'M', phone = '+22670110204', pseudo = 'cservice'
WHERE email = 'chef.service@moov-africa.bf' AND sex IS NULL;

UPDATE users SET sex = 'F', phone = '+22670110205', pseudo = 'cdepartement'
WHERE email = 'chef.departement@moov-africa.bf' AND sex IS NULL;

UPDATE users SET sex = 'M', phone = '+22670110206', pseudo = 'communitym'
WHERE email = 'community.manager@moov-africa.bf' AND sex IS NULL;

UPDATE users SET sex = 'F', phone = '+22670110207', pseudo = 'analystem'
WHERE email = 'analyste.marketing@moov-africa.bf' AND sex IS NULL;
