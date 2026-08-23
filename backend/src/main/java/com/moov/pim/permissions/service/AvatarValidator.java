package com.moov.pim.permissions.service;

/**
 * Verifie les avatars recus sous forme de data URI.
 *
 * L'image est redimensionnee par le navigateur avant l'envoi ; ce controle est la
 * garantie serveur qu'aucun contenu arbitraire ni volumineux n'atterrit en base.
 */
public final class AvatarValidator {

    /** 256 Ko de base64, soit environ 190 Ko d'image reelle. */
    private static final int MAX_LENGTH = 256 * 1024;

    private static final String PREFIX = "data:image/";

    private AvatarValidator() {}

    /**
     * @return la data URI nettoyee, ou null si aucun avatar n'est fourni.
     * @throws IllegalArgumentException si le contenu n'est pas une image ou depasse la taille maximale.
     */
    public static String normalize(String avatarUrl) {
        if (avatarUrl == null || avatarUrl.isBlank()) {
            return null;
        }
        String value = avatarUrl.trim();
        if (!value.startsWith(PREFIX)) {
            throw new IllegalArgumentException("L'avatar doit être une image encodée en data URI");
        }
        if (!value.contains(";base64,")) {
            throw new IllegalArgumentException("L'avatar doit être encodé en base64");
        }
        if (value.length() > MAX_LENGTH) {
            throw new IllegalArgumentException("L'avatar est trop volumineux (max 256 Ko encodés)");
        }
        return value;
    }
}
