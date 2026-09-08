package com.moov.pim.permissions.api.dto;

/**
 * Champs qu'un compte peut modifier lui-meme sur son profil.
 *
 * L'identite (nom, courriel, role, statut) reste du ressort de l'administrateur :
 * seuls les coordonnees et la photo sont ici. Chaque champ est facultatif ; un
 * champ absent est laisse tel quel, un champ vide efface la valeur.
 *
 * @param avatarUrl data URI (data:image/...;base64,...) redimensionnee par le
 *                  navigateur, ou chaine vide pour retirer la photo
 */
public record UpdateProfileRequest(
        String phone,
        String pseudo,
        String address,
        String avatarUrl
) {}
