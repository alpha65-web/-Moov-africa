package com.moov.pim.lifecycle.api.dto;

import java.util.Map;

/**
 * Effectif des offres visibles par le compte connecte, ventile par statut.
 *
 * Le tableau de bord tirait ses chiffres d'une page de cinq cents offres qu'il
 * comptait dans le navigateur. Au-dela de cinq cents fiches, ses compteurs
 * devenaient faux sans rien signaler, et l'anneau de repartition avec eux.
 *
 * Les dix statuts du cycle de vie sont toujours presents, y compris ceux dont
 * l'effectif est nul : l'appelant construit sa repartition sans avoir a deviner
 * quelles cles manquent, et une etape vide s'affiche comme vide plutot que de
 * disparaitre de l'anneau.
 *
 * @param total    somme des effectifs, donc le nombre d'offres visibles.
 * @param byStatus effectif par statut, clefs nommees comme {@code OfferStatus}.
 */
public record OfferStatsResponse(long total, Map<String, Long> byStatus) {}
