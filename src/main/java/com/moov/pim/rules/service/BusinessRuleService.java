package com.moov.pim.rules.service;

import com.moov.pim.rules.api.dto.BusinessRuleRequest;
import com.moov.pim.rules.api.dto.BusinessRuleResponse;
import com.moov.pim.rules.domain.BusinessRule;
import com.moov.pim.rules.domain.RuleType;
import com.moov.pim.rules.repository.BusinessRuleRepository;
import com.moov.pim.permissions.security.CustomUserDetails;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.UUID;

@Service
public class BusinessRuleService {

    private final BusinessRuleRepository ruleRepository;

    public BusinessRuleService(BusinessRuleRepository ruleRepository) {
        this.ruleRepository = ruleRepository;
    }

    @Transactional
    public BusinessRuleResponse create(BusinessRuleRequest request) {
        BusinessRule rule = new BusinessRule();
        rule.setName(request.name());
        rule.setDescription(request.description());
        rule.setRuleType(request.ruleType());
        rule.setSourceItemId(request.sourceItemId());
        rule.setTargetItemId(request.targetItemId());
        rule.setCreatedById(currentUserId());
        rule = ruleRepository.save(rule);
        return BusinessRuleResponse.from(rule);
    }

    @Transactional
    public BusinessRuleResponse update(UUID id, BusinessRuleRequest request) {
        BusinessRule rule = ruleRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Règle métier introuvable"));
        rule.setName(request.name());
        rule.setDescription(request.description());
        rule.setRuleType(request.ruleType());
        rule.setSourceItemId(request.sourceItemId());
        rule.setTargetItemId(request.targetItemId());
        rule = ruleRepository.save(rule);
        return BusinessRuleResponse.from(rule);
    }

    @Transactional(readOnly = true)
    public List<BusinessRuleResponse> listAll() {
        return ruleRepository.findAll().stream()
                .map(BusinessRuleResponse::from)
                .toList();
    }

    @Transactional(readOnly = true)
    public List<BusinessRuleResponse> listByType(RuleType type) {
        return ruleRepository.findByRuleTypeAndActiveTrue(type).stream()
                .map(BusinessRuleResponse::from)
                .toList();
    }

    @Transactional(readOnly = true)
    public List<BusinessRuleResponse> listByItem(UUID itemId) {
        return ruleRepository.findBySourceItemIdOrTargetItemId(itemId, itemId).stream()
                .map(BusinessRuleResponse::from)
                .toList();
    }

    @Transactional(readOnly = true)
    public BusinessRuleResponse getById(UUID id) {
        BusinessRule rule = ruleRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Règle métier introuvable"));
        return BusinessRuleResponse.from(rule);
    }

    @Transactional
    public void activate(UUID id) {
        BusinessRule rule = ruleRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Règle métier introuvable"));
        rule.setActive(true);
        ruleRepository.save(rule);
    }

    @Transactional
    public void deactivate(UUID id) {
        BusinessRule rule = ruleRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Règle métier introuvable"));
        rule.setActive(false);
        ruleRepository.save(rule);
    }

    @Transactional
    public void delete(UUID id) {
        if (!ruleRepository.existsById(id)) {
            throw new IllegalArgumentException("Règle métier introuvable");
        }
        ruleRepository.deleteById(id);
    }

    private UUID currentUserId() {
        CustomUserDetails principal = (CustomUserDetails) SecurityContextHolder
                .getContext().getAuthentication().getPrincipal();
        return principal.getUserId();
    }
}
