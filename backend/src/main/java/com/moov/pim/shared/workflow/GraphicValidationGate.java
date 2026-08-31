package com.moov.pim.shared.workflow;

import java.util.Optional;
import java.util.UUID;

/**
 * Etat du circuit de validation graphique d'une offre, vu depuis le cycle de vie.
 *
 * Le cahier des charges (7.6) enchaine les deux circuits : « une fois la
 * validation graphique obtenue, l'offre poursuit vers la validation generale ».
 * Cet enchainement n'existait pas — {@code OfferService} ne consultait jamais
 * l'etat des visuels, si bien qu'une offre partait en validation metier avec des
 * medias encore en attente, voire rejetes. Le chef de departement validait alors
 * une fiche dont les visuels n'etaient pas approuves, et le circuit graphique se
 * retrouvait sans effet sur le circuit qu'il est cense conditionner.
 *
 * Le contrat passe par le module commun plutot que par une dependance directe du
 * cycle de vie vers le DAM : c'est le module des medias qui sait ce qu'est un
 * visuel approuve, et le cycle de vie n'a besoin que de la reponse.
 */
public interface GraphicValidationGate {

    /**
     * @param offerId offre sur le point de partir en validation metier
     * @return le motif du blocage, ou vide si la fiche peut poursuivre. Une offre
     *         sans aucun visuel n'est jamais bloquee : il n'y a rien a valider
     *         graphiquement, et l'exiger interdirait de soumettre une offre qui
     *         n'en comporte pas — ce que le cahier des charges ne demande nulle
     *         part.
     */
    Optional<String> blockingReason(UUID offerId);
}
