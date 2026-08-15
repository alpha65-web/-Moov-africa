package com.moov.pim.rules.api.dto;

import com.moov.pim.rules.domain.BusinessRule;

import java.time.LocalDateTime;
import java.util.UUID;

public record BusinessRuleResponse(
        UUID id,
        String name,
        String description,
        String ruleType,
        boolean active,
        UUID sourceItemId,
        UUID targetItemId,
        UUID createdById,
        LocalDateTime createdAt
) {
    public static BusinessRuleResponse from(BusinessRule rule) {
        return new BusinessRuleResponse(
                rule.getId(),
                rule.getName(),
                rule.getDescription(),
                rule.getRuleType().name(),
                rule.isActive(),
                rule.getSourceItemId(),
                rule.getTargetItemId(),
                rule.getCreatedById(),
                rule.getCreatedAt()
        );
    }
}
