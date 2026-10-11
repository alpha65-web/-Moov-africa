package com.moov.pim.permissions.domain;

/**
 * Etat d'une demande de reinitialisation de mot de passe.
 *
 * PENDING tant que l'administrateur ne s'en est pas occupe, HANDLED une fois le
 * mot de passe repose, CANCELLED lorsqu'il ecarte la demande sans y donner
 * suite, par exemple parce qu'elle ne vient pas du titulaire du compte.
 */
public enum PasswordResetRequestStatus {
    PENDING,
    HANDLED,
    CANCELLED
}
