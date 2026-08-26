package com.moov.pim.lifecycle.api.dto;

import java.util.UUID;

/**
 * Designation de l'analyste marketing charge de l'enrichissement.
 *
 * Un identifiant nul retire l'affectation et remet la fiche dans le lot commun :
 * c'est ce qui permet au chef de service de reprendre une repartition, par
 * exemple lorsqu'un analyste est absent.
 */
public record AssignOfferRequest(UUID analystId) {}
