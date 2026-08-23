package com.moov.pim.ai.api.dto;

import jakarta.validation.constraints.NotBlank;
import java.util.UUID;

/**
 * @param type          DESCRIPTION, TAGS ou TRANSLATION
 * @param tone          PROFESSIONAL ou CREATIVE
 * @param language      code langue cible pour TRANSLATION (fr, en, ar, sw)
 * @param catalogItemId element du catalogue servant de source ; prioritaire sur subject
 * @param offerId       offre servant de source ; utilisee si catalogItemId est absent
 * @param subject       libelle libre lorsqu'aucune entite n'est selectionnee
 */
public record AiGenerationRequest(
        @NotBlank String type,
        String tone,
        String language,
        UUID catalogItemId,
        UUID offerId,
        String subject
) {}
