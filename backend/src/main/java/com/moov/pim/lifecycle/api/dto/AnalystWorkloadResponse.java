package com.moov.pim.lifecycle.api.dto;

import java.util.UUID;

/**
 * Analyste marketing auquel une offre peut etre confiee, et sa charge du moment.
 *
 * Le chef de service repartit l'enrichissement en fonction de la disponibilite de
 * chacun : lui presenter une liste de noms sans indication de charge revient a lui
 * demander d'arbitrer sans donnee. Les deux compteurs sont calcules sur les offres
 * reellement affectees, jamais declares.
 *
 * N'expose que l'identite : le chef de service n'a pas a connaitre l'adresse, le
 * telephone ni l'etat du compte de ses collegues pour repartir du travail.
 *
 * @param activeCount offres actuellement confiees a cet analyste et encore au
 *                    statut En enrichissement : sa charge ouverte.
 * @param totalCount  offres qui lui ont ete confiees depuis le debut, tous statuts
 *                    confondus. Distingue un analyste momentanement libre d'un
 *                    analyste qui n'est jamais sollicite.
 */
public record AnalystWorkloadResponse(UUID id, String firstName, String lastName,
                                      long activeCount, long totalCount) {}
