package com.moov.pim.shared.workflow;

import java.util.Optional;
import java.util.UUID;

/**
 * Visuels d'une offre utilisables pour une diffusion, vus depuis les campagnes.
 *
 * Le cahier des charges confie au community manager « la preparation et la
 * programmation de campagnes de diffusion » (l. 107) mais reserve « le depot et
 * l'association des medias » a l'analyste marketing (l. 104 et 154), tout visuel
 * devant en outre franchir la validation graphique du chef de service (l. 158)
 * avant que l'offre parte en validation metier.
 *
 * Le community manager designe donc un visuel, il n'en depose pas. Encore
 * faut-il verifier que celui qu'il designe est bien rattache a l'offre diffusee
 * et bien approuve : sans ce controle, une requete envoyee directement a l'API
 * accrocherait a une campagne Facebook n'importe quel fichier de la mediatheque,
 * y compris un visuel rejete par le chef de service — ce qui reviendrait a
 * contourner le circuit graphique par la porte de la diffusion.
 *
 * Le contrat passe par le module commun plutot que par une dependance directe
 * des campagnes vers le DAM, comme {@link GraphicValidationGate} pour le cycle
 * de vie : c'est le module des medias qui sait ce qu'est un visuel approuve.
 */
public interface OfferMediaGate {

    /**
     * @param offerId      offre diffusee par la campagne
     * @param mediaAssetId visuel designe pour accompagner la diffusion
     * @return le motif du refus, ou vide si le visuel peut accompagner la
     *         diffusion de cette offre.
     */
    Optional<String> rejectionReason(UUID offerId, UUID mediaAssetId);
}
