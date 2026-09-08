package com.moov.pim.rules.api.dto;

import java.util.List;
import java.util.UUID;

/**
 * Incoherence relevee dans l'ensemble des regles metier.
 *
 * Le cahier des charges (7.3) demande que l'administrateur puisse « verifier la
 * coherence globale des regles ». Une regle est coherente prise isolement ; c'est
 * leur ensemble qui peut se contredire, se repeter ou designer des briques qui
 * n'existent plus.
 *
 * @param code     famille d'incoherence : CONTRADICTION, DUPLICATE, ARCHIVED_ITEM,
 *                 SELF_REFERENCE, MANDATORY_CYCLE
 * @param severity ERROR quand l'ensemble ne peut pas etre applique tel quel,
 *                 WARNING quand il s'applique mais qu'une regle est inutile ou
 *                 douteuse
 * @param ruleIds  regles en cause, pour que l'ecran les mette en evidence
 * @param message  explication lisible, avec les noms des regles et des briques
 */
public record RuleConsistencyIssue(String code, String severity, List<UUID> ruleIds, String message) {}
