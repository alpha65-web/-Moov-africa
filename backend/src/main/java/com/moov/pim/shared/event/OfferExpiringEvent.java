package com.moov.pim.shared.event;

import java.util.UUID;

/**
 * Offre publiee dont la date de fin de validite approche.
 *
 * Cette alerte n'existait que sous forme de ligne dans le journal technique du
 * serveur : personne, dans l'application, n'apprenait qu'une offre allait
 * expirer. Le chef de produit decouvrait le declassement une fois qu'il avait eu
 * lieu, alors que le seul interet de l'alerte est de lui laisser le temps de
 * prolonger l'offre ou de preparer la suivante.
 *
 * @param validUntil date de fin de validite, deja formatee pour l'affichage :
 *                   le module de notification compose un message, il n'a pas a
 *                   connaitre les conventions de date du module du cycle de vie.
 */
public record OfferExpiringEvent(UUID offerId, String offerName, UUID createdById, String validUntil) {}
