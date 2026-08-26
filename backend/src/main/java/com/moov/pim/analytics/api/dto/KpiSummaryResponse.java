package com.moov.pim.analytics.api.dto;

import java.util.List;
import java.util.UUID;

/**
 * Indicateurs agreges du cahier des charges (section 7.9).
 *
 * L'ecran d'analytique ne disposait que de la liste brute des evenements : il
 * telechargeait cinq cents lignes pour en tirer une moyenne dans le navigateur,
 * et aucun des indicateurs demandes n'etait calcule. L'agregation est ramenee
 * ici, cote serveur, seul endroit ou elle tient a l'echelle du catalogue reel.
 *
 * Toutes les valeurs proviennent de la table kpi_events, alimentee a chaque
 * creation et a chaque transition reelle. Une periode sans activite renvoie des
 * listes vides et des medianes nulles : l'interface doit alors afficher l'absence
 * de donnee, jamais une valeur de remplissage.
 *
 * @param scope             TEAM si le compte voit toute l'equipe, SELF s'il ne
 *                          voit que son propre temps de traitement.
 * @param trackedOffers     nombre d'offres ayant au moins un evenement.
 * @param publishedOffers   nombre d'offres passees a PUBLISHED sur la periode.
 * @param ttmMedianMs       Time To Market median, null si aucune publication.
 * @param ttmAverageMs      Time To Market moyen, null si aucune publication.
 * @param ttmByOffer        detail par offre publiee, du plus lent au plus rapide.
 * @param stages            temps moyen passe dans chaque etape et volume traite.
 * @param bottleneckStage   etape au temps moyen le plus eleve, null si indetermine.
 */
public record KpiSummaryResponse(
        String scope,
        long trackedOffers,
        long publishedOffers,
        Long ttmMedianMs,
        Long ttmAverageMs,
        List<OfferTimeToMarket> ttmByOffer,
        List<StageStat> stages,
        String bottleneckStage
) {

    /** Delai entre la creation d'une offre et sa publication. */
    public record OfferTimeToMarket(UUID offerId, long durationMs) {}

    /**
     * Temps passe dans une etape avant d'en sortir.
     *
     * @param stage       statut occupe pendant la duree mesuree.
     * @param averageMs   duree moyenne de sejour dans ce statut.
     * @param count       nombre de passages mesures, pour juger de la fiabilite.
     */
    public record StageStat(String stage, long averageMs, long count) {}
}
