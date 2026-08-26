package com.moov.pim.shared.event;

import java.util.UUID;

/**
 * Repartition d'une offre a un analyste marketing par le chef de service.
 *
 * L'affectation etait silencieuse : elle ecrivait assigned_to_id et s'arretait la.
 * Or elle se pose a tout moment, y compris apres le passage en enrichissement —
 * c'est meme le cas courant, puisque le chef de service repartit le travail en
 * fonction de la charge de chacun au moment ou il la constate. Dans ce cas
 * l'analyste designe n'apprenait jamais qu'une fiche lui avait ete confiee : la
 * notification de transition etait deja partie, vers l'ensemble des analystes.
 *
 * @param analystId analyste designe, {@code null} lorsque le chef de service
 *                  libere la fiche et la remet dans le lot commun.
 */
public record OfferAssignedEvent(UUID offerId, String offerName, UUID analystId, UUID assignedById) {}
