package com.moov.pim.integration.api.dto;

import java.time.LocalDateTime;
import java.util.UUID;

/**
 * Une fiche telle qu'un systeme tiers la consomme.
 *
 * @param state ACTIVE ou WITHDRAWN. Un flux qui ne transporterait que les offres
 *              actives condamnerait le destinataire a garder indefiniment celles
 *              qui ont ete retirees : il ne saurait pas distinguer une offre
 *              retiree d'une offre simplement absente de la page courante.
 * @param fiche corps de la fiche, exactement tel qu'il a ete constitue au moment
 *              de la publication. Il n'est pas reconstruit a la lecture : le
 *              destinataire doit recevoir l'etat mis en ligne, pas un etat
 *              recalcule depuis une offre qui a pu bouger depuis.
 */
public record FeedEntry(
        UUID offerId,
        String state,
        LocalDateTime publishedAt,
        Object fiche
) {}
