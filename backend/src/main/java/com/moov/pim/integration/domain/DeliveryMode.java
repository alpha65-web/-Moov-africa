package com.moov.pim.integration.domain;

/**
 * Canal par lequel la fiche atteint le systeme destinataire.
 *
 * Le sujet ouvre les deux : « API ou export pour le CRM ou le centre d'appel ».
 * La distinction n'est pas cosmetique, elle change ce que le statut de l'export
 * signifie. En PUSH la plateforme appelle le systeme tiers et le code de reponse
 * HTTP fait foi ; en PULL elle met la fiche a disposition sur /feed et c'est la
 * lecture par le destinataire qui atteste la diffusion.
 */
public enum DeliveryMode {
    PUSH, PULL
}
