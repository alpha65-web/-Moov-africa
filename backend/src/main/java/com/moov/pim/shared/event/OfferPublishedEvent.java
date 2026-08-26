package com.moov.pim.shared.event;

import java.util.UUID;

/**
 * Publication effective d'une offre : le signal de depart de la diffusion.
 *
 * Distinct de {@link OfferTransitionEvent}, qui decrit n'importe quel changement
 * de statut. Le cahier des charges (section 7.11) impose que « des publication,
 * la fiche complete est automatiquement diffusee en temps reel vers le CRM, le
 * centre d'appel et le site web/e-boutique ». Cette diffusion n'existait pas :
 * IntegrationExportService.triggerAutoExport etait ecrit mais n'etait appele par
 * aucun code de production — uniquement par ses propres tests. Verifie en
 * deroulant un circuit complet : une offre passee en PUBLIEE n'ouvrait aucune
 * ligne dans integration_exports, et l'ecran Exports restait vide alors meme que
 * des offres etaient en ligne.
 *
 * @param payload fiche complete serialisee au moment de la publication. Elle est
 *                transportee par l'evenement plutot que relue par le module de
 *                diffusion : c'est le module du cycle de vie qui sait ce que
 *                contient une fiche, et l'etat diffuse doit etre celui de
 *                l'instant de la publication, pas celui du moment ou le
 *                consommateur se reveille.
 */
public record OfferPublishedEvent(UUID offerId, String offerName, UUID publishedById, String payload) {}
