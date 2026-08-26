package com.moov.pim.integration.api.dto;

import java.util.Map;
import java.util.UUID;

/**
 * Etat de diffusion d'une offre vers chacun des systemes destinataires.
 *
 * Sert le rapprochement confie au chef de departement par le cahier des charges
 * (l. 106). Celui-ci publie les offres : il doit pouvoir verifier qu'elles sont
 * effectivement arrivees dans le CRM, au centre d'appel et sur le site web. Aucun
 * ecran ne le lui permettait — la seule vue des exports etait l'ecran
 * d'administration, ferme par EXPORT_MANAGE, que son role ne detient pas.
 *
 * La reponse ne porte volontairement pas le nom de l'offre : l'ecran des
 * indicateurs charge deja la liste des offres et resout l'identite lui-meme. Le
 * module de diffusion n'a donc pas a interroger celui du cycle de vie.
 *
 * @param statusByTarget statut le plus favorable observe pour chaque systeme
 *                       destinataire. Un systeme absent de la table n'a jamais
 *                       recu la fiche.
 */
public record OfferDiffusionRow(UUID offerId, Map<String, String> statusByTarget) {}
