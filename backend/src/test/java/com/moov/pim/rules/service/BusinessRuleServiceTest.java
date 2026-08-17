package com.moov.pim.rules.service;

import com.moov.pim.permissions.domain.Role;
import com.moov.pim.permissions.domain.RoleName;
import com.moov.pim.permissions.domain.User;
import com.moov.pim.permissions.security.CustomUserDetails;
import com.moov.pim.rules.api.dto.BusinessRuleRequest;
import com.moov.pim.rules.api.dto.BusinessRuleResponse;
import com.moov.pim.rules.domain.BusinessRule;
import com.moov.pim.rules.domain.RuleType;
import com.moov.pim.rules.repository.BusinessRuleRepository;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;

import java.lang.reflect.Field;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class BusinessRuleServiceTest {

    @Mock private BusinessRuleRepository ruleRepository;

    @InjectMocks private BusinessRuleService businessRuleService;

    private UUID userId;

    @BeforeEach
    void setUp() throws Exception {
        userId = UUID.randomUUID();
        Role role = createRole(RoleName.CHEF_PRODUIT);
        User user = new User("chef@moov.bf", "$2a$hash", "Chef", "Produit", role);
        setField(User.class, user, "id", userId);

        CustomUserDetails details = new CustomUserDetails(user);
        SecurityContextHolder.getContext().setAuthentication(
                new UsernamePasswordAuthenticationToken(details, null, details.getAuthorities()));
    }

    @AfterEach
    void tearDown() {
        SecurityContextHolder.clearContext();
    }

    @Test
    void create_shouldCreateRule() {
        UUID sourceId = UUID.randomUUID();
        UUID targetId = UUID.randomUUID();
        BusinessRuleRequest request = new BusinessRuleRequest(
                "Compatibilité SIM-Forfait", "SIM compatible avec forfait",
                RuleType.COMPATIBILITY, sourceId, targetId);

        when(ruleRepository.save(any(BusinessRule.class))).thenAnswer(inv -> {
            BusinessRule r = inv.getArgument(0);
            setField(BusinessRule.class, r, "id", UUID.randomUUID());
            return r;
        });

        BusinessRuleResponse response = businessRuleService.create(request);

        assertNotNull(response);
        assertEquals("Compatibilité SIM-Forfait", response.name());
        assertEquals("COMPATIBILITY", response.ruleType());
        assertTrue(response.active());
        assertEquals(sourceId, response.sourceItemId());
        assertEquals(targetId, response.targetItemId());
    }

    @Test
    void update_shouldUpdateRule() {
        UUID ruleId = UUID.randomUUID();
        BusinessRule rule = createRule(ruleId, "Ancienne", RuleType.COMPATIBILITY);

        UUID newSource = UUID.randomUUID();
        UUID newTarget = UUID.randomUUID();
        BusinessRuleRequest request = new BusinessRuleRequest(
                "Nouvelle", "Desc modifiée", RuleType.INCOMPATIBILITY, newSource, newTarget);

        when(ruleRepository.findById(ruleId)).thenReturn(Optional.of(rule));
        when(ruleRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));

        BusinessRuleResponse response = businessRuleService.update(ruleId, request);

        assertEquals("Nouvelle", response.name());
        assertEquals("INCOMPATIBILITY", response.ruleType());
    }

    @Test
    void update_shouldThrowIfNotFound() {
        UUID fakeId = UUID.randomUUID();
        BusinessRuleRequest request = new BusinessRuleRequest(
                "X", "Y", RuleType.COMPATIBILITY, UUID.randomUUID(), UUID.randomUUID());

        when(ruleRepository.findById(fakeId)).thenReturn(Optional.empty());

        assertThrows(IllegalArgumentException.class, () -> businessRuleService.update(fakeId, request));
    }

    @Test
    void listAll_shouldReturnAllRules() {
        BusinessRule rule = createRule(UUID.randomUUID(), "Règle A", RuleType.PACK_ONLY);

        when(ruleRepository.findAll()).thenReturn(List.of(rule));

        List<BusinessRuleResponse> results = businessRuleService.listAll();

        assertEquals(1, results.size());
        assertEquals("Règle A", results.get(0).name());
    }

    @Test
    void listByType_shouldFilterByType() {
        BusinessRule rule = createRule(UUID.randomUUID(), "Compat", RuleType.COMPATIBILITY);

        when(ruleRepository.findByRuleTypeAndActiveTrue(RuleType.COMPATIBILITY)).thenReturn(List.of(rule));

        List<BusinessRuleResponse> results = businessRuleService.listByType(RuleType.COMPATIBILITY);

        assertEquals(1, results.size());
        assertEquals("COMPATIBILITY", results.get(0).ruleType());
    }

    @Test
    void listByItem_shouldFindBySourceOrTarget() {
        UUID itemId = UUID.randomUUID();
        BusinessRule rule = createRule(UUID.randomUUID(), "Règle lien", RuleType.MANDATORY_COMPOSITION);

        when(ruleRepository.findBySourceItemIdOrTargetItemId(itemId, itemId)).thenReturn(List.of(rule));

        List<BusinessRuleResponse> results = businessRuleService.listByItem(itemId);

        assertEquals(1, results.size());
    }

    @Test
    void getById_shouldReturnRule() {
        UUID ruleId = UUID.randomUUID();
        BusinessRule rule = createRule(ruleId, "Ma règle", RuleType.INCOMPATIBILITY);

        when(ruleRepository.findById(ruleId)).thenReturn(Optional.of(rule));

        BusinessRuleResponse response = businessRuleService.getById(ruleId);

        assertEquals("Ma règle", response.name());
    }

    @Test
    void getById_shouldThrowIfNotFound() {
        UUID fakeId = UUID.randomUUID();
        when(ruleRepository.findById(fakeId)).thenReturn(Optional.empty());

        assertThrows(IllegalArgumentException.class, () -> businessRuleService.getById(fakeId));
    }

    @Test
    void activate_shouldSetActiveTrue() {
        UUID ruleId = UUID.randomUUID();
        BusinessRule rule = createRule(ruleId, "Inactive", RuleType.COMPATIBILITY);
        rule.setActive(false);

        when(ruleRepository.findById(ruleId)).thenReturn(Optional.of(rule));
        when(ruleRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));

        businessRuleService.activate(ruleId);

        assertTrue(rule.isActive());
        verify(ruleRepository).save(rule);
    }

    @Test
    void deactivate_shouldSetActiveFalse() {
        UUID ruleId = UUID.randomUUID();
        BusinessRule rule = createRule(ruleId, "Active", RuleType.COMPATIBILITY);

        when(ruleRepository.findById(ruleId)).thenReturn(Optional.of(rule));
        when(ruleRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));

        businessRuleService.deactivate(ruleId);

        assertFalse(rule.isActive());
        verify(ruleRepository).save(rule);
    }

    @Test
    void delete_shouldDeleteExistingRule() {
        UUID ruleId = UUID.randomUUID();
        when(ruleRepository.existsById(ruleId)).thenReturn(true);

        businessRuleService.delete(ruleId);

        verify(ruleRepository).deleteById(ruleId);
    }

    @Test
    void delete_shouldThrowIfNotFound() {
        UUID fakeId = UUID.randomUUID();
        when(ruleRepository.existsById(fakeId)).thenReturn(false);

        assertThrows(IllegalArgumentException.class, () -> businessRuleService.delete(fakeId));
    }

    private BusinessRule createRule(UUID id, String name, RuleType type) {
        BusinessRule rule = new BusinessRule();
        rule.setName(name);
        rule.setRuleType(type);
        rule.setSourceItemId(UUID.randomUUID());
        rule.setTargetItemId(UUID.randomUUID());
        rule.setCreatedById(userId);
        setField(BusinessRule.class, rule, "id", id);
        return rule;
    }

    private static void setField(Class<?> clazz, Object target, String fieldName, Object value) {
        try {
            Field field = clazz.getDeclaredField(fieldName);
            field.setAccessible(true);
            field.set(target, value);
        } catch (Exception e) {
            throw new RuntimeException(e);
        }
    }

    private static Role createRole(RoleName roleName) {
        try {
            var constructor = Role.class.getDeclaredConstructor();
            constructor.setAccessible(true);
            Role role = constructor.newInstance();
            Field nameField = Role.class.getDeclaredField("name");
            nameField.setAccessible(true);
            nameField.set(role, roleName);
            Field idField = Role.class.getDeclaredField("id");
            idField.setAccessible(true);
            idField.set(role, UUID.randomUUID());
            return role;
        } catch (Exception e) {
            throw new RuntimeException(e);
        }
    }
}
