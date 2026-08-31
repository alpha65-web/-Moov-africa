package com.moov.pim.integration.domain;

/**
 * Nature de la diffusion.
 *
 * WITHDRAWAL manquait : une offre retiree, suspendue ou obsolete restait diffusee
 * dans les systemes tiers, qui n'avaient aucun moyen d'apprendre son retrait. Une
 * information produit « en temps reel » doit propager les retraits aussi bien que
 * les mises en ligne, sans quoi le centre d'appel continue de vendre une offre
 * que la plateforme a deja retiree.
 */
public enum ExportType {
    AUTO_PUBLISH, MANUAL_EXPORT, RESYNC, CATALOG_EXPORT, WITHDRAWAL
}
