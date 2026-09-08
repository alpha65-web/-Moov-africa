package com.moov.pim.rules.api.dto;

import jakarta.validation.constraints.NotNull;

import java.util.List;
import java.util.UUID;

/**
 * Composition soumise a l'evaluation des regles metier avant enregistrement.
 *
 * Le chef de produit assemble son offre brique par brique ; chaque ajout est
 * evalue pour qu'il sache, avant de soumettre, ce qui bloque et ce qui n'est
 * qu'un avertissement. Le meme controle est rejoue par le serveur a
 * l'enregistrement : cet appel n'accorde rien, il informe.
 *
 * @param catalogItemIds briques choisies, dans l'ordre de saisie
 */
public record CompositionEvaluationRequest(@NotNull List<UUID> catalogItemIds) {}
