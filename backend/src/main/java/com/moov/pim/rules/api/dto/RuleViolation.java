package com.moov.pim.rules.api.dto;

import java.util.UUID;

/**
 * Contrainte metier violee par la composition d'une offre.
 *
 * @param ruleId    regle en cause, nulle pour les contraintes portees par
 *                  l'element lui-meme et non par la table des regles — c'est le
 *                  cas de « vendable uniquement en pack », qui est un attribut du
 *                  produit ou du service.
 * @param blocking  true : la composition est refusee. false : elle est acceptee et
 *                  la violation est seulement signalee, ce qui permet d'introduire
 *                  une contrainte sur un catalogue deja constitue.
 */
public record RuleViolation(UUID ruleId, String ruleName, String ruleType,
                            String message, boolean blocking) {}
