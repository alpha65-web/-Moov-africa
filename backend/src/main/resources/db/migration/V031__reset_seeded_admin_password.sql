-- Le hash pose par V015 ne correspond pas au mot de passe annonce dans son
-- commentaire (« Admin@2024 ») : verifie par BCrypt.checkpw, aucune des valeurs
-- documentees ne valide. Le compte admin@moov-africa.bf etait donc inutilisable.
--
-- Nouveau mot de passe : MoovPim@2026!
-- Conforme a PasswordPolicyService (12 caracteres minimum, majuscule, minuscule,
-- chiffre, caractere special) ; « Admin@2024 » ne l'etait pas, avec ses 10 caracteres.
-- Hash BCrypt cost 12, aligne sur les comptes de demonstration de V022.
--
-- force_password_change reste a true : le mot de passe ci-dessus n'ouvre que la
-- premiere connexion, l'utilisateur doit en choisir un autre immediatement.
UPDATE users
SET password_hash = '$2a$12$XKK4.p99cHHfuXo5Au6pou6xNLs9MCpwgh0s4FUEKimYisLTzAVaG',
    force_password_change = true,
    failed_login_attempts = 0,
    status = 'ACTIVE'
WHERE email = 'admin@moov-africa.bf';
