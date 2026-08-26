package com.moov.pim.integration.service;

import com.moov.pim.shared.event.OfferPublishedEvent;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.modulith.events.ApplicationModuleListener;
import org.springframework.stereotype.Component;

/**
 * Declenche la diffusion multicanale des qu'une offre est mise en ligne.
 *
 * C'est le maillon qui manquait au circuit. {@code triggerAutoExport} existait
 * depuis l'origine mais n'etait invoque par aucun code de production : verifie
 * par recherche sur l'ensemble du depot, ses seuls appelants etaient ses propres
 * tests. Concretement, une offre passee en PUBLIEE n'ouvrait aucune ligne dans
 * integration_exports ; le cahier des charges (section 7.11) exige pourtant que
 * « des publication, la fiche complete soit automatiquement diffusee en temps
 * reel vers le CRM, le centre d'appel et le site web/e-boutique ».
 *
 * Le branchement passe par un evenement plutot que par un appel direct depuis le
 * service des offres : celui-ci n'a pas a connaitre ses consommateurs, et une
 * diffusion en echec ne doit pas faire echouer la publication elle-meme, qui est
 * une decision metier deja prise et historisee.
 */
@Component
public class OfferDiffusionListener {

    private static final Logger log = LoggerFactory.getLogger(OfferDiffusionListener.class);

    private final IntegrationExportService exportService;

    public OfferDiffusionListener(IntegrationExportService exportService) {
        this.exportService = exportService;
    }

    @ApplicationModuleListener
    public void on(OfferPublishedEvent event) {
        log.info("Publication de l'offre {} : ouverture de la diffusion multicanale", event.offerId());
        exportService.triggerAutoExport(event.offerId(), event.payload());
    }
}
