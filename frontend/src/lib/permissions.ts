"use client";

import { useMemo } from "react";
import { useAuth } from "./auth";
import type { OfferStatus } from "./types";

/**
 * Lecture des permissions du compte connecte.
 *
 * Les ecrans affichaient leurs actions d'ecriture sans consulter le role : un
 * analyste marketing voyait « Creer une offre » alors qu'il ne detient pas
 * OFFER_CREATE, un chef de service voyait « Valider le media » sans detenir
 * MEDIA_VALIDATE. Le serveur refusait bien ces appels, mais un bouton propose
 * puis refuse en 403 se lit comme une panne de la plateforme, pas comme une
 * regle de securite.
 *
 * Les codes sont ceux que le backend renvoie dans `user.permissions`, et ils
 * doivent rester en miroir des annotations @PreAuthorize des controleurs : une
 * action ne s'affiche que si l'appel qu'elle declenche a une chance d'aboutir.
 */
export function usePermissions() {
  const { user } = useAuth();

  return useMemo(() => {
    const granted = new Set(user?.permissions ?? []);
    return {
      /** Le compte detient-il cette permission precise ? */
      has: (code: string) => granted.has(code),
      /** Le compte detient-il au moins une des permissions listees ? */
      hasAny: (...codes: string[]) => codes.some((code) => granted.has(code)),
      /** Le compte detient-il toutes les permissions listees ? */
      hasAll: (...codes: string[]) => codes.every((code) => granted.has(code)),
      role: user?.role ?? null,
    };
  }, [user]);
}

/** Codes de permission utilises par les ecrans, pour eviter les chaines libres. */
export const PERM = {
  USER_MANAGE: "USER_MANAGE",
  CATALOG_READ: "CATALOG_READ",
  CATALOG_MANAGE: "CATALOG_MANAGE",
  /** Ajoutee par la migration V017, exigee par les ecritures sur les tests A/B. */
  CATALOG_WRITE: "CATALOG_WRITE",
  RULE_MANAGE: "RULE_MANAGE",
  OFFER_CREATE: "OFFER_CREATE",
  OFFER_ENRICH: "OFFER_ENRICH",
  /** Repartir les offres entre les analystes ; detenue par le chef de service. */
  OFFER_ASSIGN: "OFFER_ASSIGN",
  OFFER_SUBMIT: "OFFER_SUBMIT",
  OFFER_VALIDATE: "OFFER_VALIDATE",
  OFFER_PUBLISH: "OFFER_PUBLISH",
  MEDIA_UPLOAD: "MEDIA_UPLOAD",
  MEDIA_VALIDATE: "MEDIA_VALIDATE",
  CAMPAIGN_MANAGE: "CAMPAIGN_MANAGE",
  ANALYTICS_VIEW: "ANALYTICS_VIEW",
  /** Perimetre transversal des indicateurs : chiffres de toute l'equipe et
      rapprochement avec les systemes tiers. Ajoutee par la migration V038. */
  ANALYTICS_TEAM_VIEW: "ANALYTICS_TEAM_VIEW",
  AUDIT_VIEW: "AUDIT_VIEW",
  CONFIG_MANAGE: "CONFIG_MANAGE",
  EXPORT_MANAGE: "EXPORT_MANAGE",
} as const;

/**
 * File d'attente propre a chaque metier : les statuts d'offre sur lesquels le
 * titulaire d'une permission a effectivement quelque chose a faire.
 *
 * Les ecrans ouvraient sur la totalite du catalogue, tous statuts confondus.
 * Chaque acteur devait donc retrouver lui-meme les fiches qui le concernaient
 * parmi celles des autres, alors que son role ne lui permet d'agir que sur une
 * etape precise du circuit.
 */
export const QUEUE_BY_PERMISSION: Record<string, OfferStatus[]> = {
  [PERM.OFFER_SUBMIT]: ["DRAFT", "IN_ENRICHMENT"],
  [PERM.OFFER_ENRICH]: ["DRAFT", "IN_ENRICHMENT"],
  [PERM.OFFER_VALIDATE]: ["IN_VALIDATION"],
  [PERM.OFFER_PUBLISH]: ["VALIDATED", "PLANNED"],
};

/** Statuts a traiter par ce compte, toutes ses permissions reunies. */
export function queueStatusesFor(has: (code: string) => boolean): OfferStatus[] {
  return Object.entries(QUEUE_BY_PERMISSION)
    .filter(([code]) => has(code))
    .flatMap(([, statuses]) => statuses)
    .filter((status, index, all) => all.indexOf(status) === index);
}
