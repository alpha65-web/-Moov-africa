package com.moov.pim.rules.repository;

import com.moov.pim.rules.domain.BusinessRule;
import com.moov.pim.rules.domain.RuleType;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.UUID;

public interface BusinessRuleRepository extends JpaRepository<BusinessRule, UUID> {

    List<BusinessRule> findBySourceItemId(UUID sourceItemId);

    List<BusinessRule> findByTargetItemId(UUID targetItemId);

    List<BusinessRule> findByRuleTypeAndActiveTrue(RuleType ruleType);

    List<BusinessRule> findBySourceItemIdOrTargetItemId(UUID sourceItemId, UUID targetItemId);
}
