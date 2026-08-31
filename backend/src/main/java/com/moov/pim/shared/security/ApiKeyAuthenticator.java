package com.moov.pim.shared.security;

import java.util.Optional;
import java.util.UUID;

/**
 * Verification d'une cle de consommation, vue depuis la couche de securite.
 *
 * L'implementation vit dans le module d'integration, qui detient les cles ; la
 * chaine de filtres, elle, est commune a toute l'application. Passer par ce
 * contrat evite que la configuration de securite ait a connaitre le module
 * d'integration, comme elle ignore deja les autres modules metier.
 */
public interface ApiKeyAuthenticator {

    /**
     * @param presentedKey valeur brute presentee dans l'en-tete X-Api-Key
     * @return le porteur de la cle si elle est valide et active, sinon vide
     */
    Optional<ApiKeyPrincipal> authenticate(String presentedKey);

    /**
     * Porteur d'une cle : un systeme destinataire, pas une personne.
     *
     * @param targetSystem canal auquel la cle donne acces. Il borne ce que la cle
     *                     peut lire : le centre d'appel ne consomme pas le flux du
     *                     site web, et l'inverse est vrai aussi.
     */
    record ApiKeyPrincipal(UUID keyId, String label, String targetSystem) {}
}
