package com.moov.pim.shared.security;

import com.moov.pim.analytics.domain.AuditAction;
import com.moov.pim.analytics.service.AuditService;
import com.moov.pim.permissions.domain.AccountStatus;
import com.moov.pim.permissions.domain.Role;
import com.moov.pim.permissions.domain.RoleName;
import com.moov.pim.permissions.domain.User;
import com.moov.pim.permissions.repository.UserRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.lang.reflect.Field;
import java.util.Optional;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class DataAnonymizationServiceTest {

    @Mock private UserRepository userRepository;
    @Mock private AuditService auditService;

    @InjectMocks private DataAnonymizationService anonymizationService;

    @Test
    void anonymizeUser_shouldAnonymizeAllFields() throws Exception {
        UUID userId = UUID.randomUUID();
        UUID requestedBy = UUID.randomUUID();
        Role role = createRole(RoleName.CHEF_PRODUIT);
        User user = new User("chef@moov.bf", "$2a$hash", "Chef", "Produit", role);
        setField(User.class, user, "id", userId);
        user.setTotpSecret("JBSWY3DPEHPK3PXP");
        user.setTotpEnabled(true);

        when(userRepository.findById(userId)).thenReturn(Optional.of(user));
        when(userRepository.save(any(User.class))).thenAnswer(inv -> inv.getArgument(0));

        anonymizationService.anonymizeUser(userId, requestedBy);

        assertTrue(user.getEmail().startsWith("anon_"));
        assertTrue(user.getEmail().endsWith("@anonymized.local"));
        assertEquals("Anonymized", user.getFirstName());
        assertEquals("User", user.getLastName());
        assertEquals(AccountStatus.DEACTIVATED, user.getStatus());
        assertEquals("$ANONYMIZED$", user.getPasswordHash());
        assertNull(user.getTotpSecret());
        assertFalse(user.isTotpEnabled());
        assertEquals(0, user.getFailedLoginAttempts());
        assertNotNull(user.getAnonymizedAt());

        verify(userRepository).save(user);
        verify(auditService).log(
                eq(requestedBy), eq(AuditAction.DATA_ANONYMIZED),
                eq("User"), eq(userId),
                any(), any(), any());
    }

    @Test
    void anonymizeUser_shouldThrowIfUserNotFound() {
        UUID fakeId = UUID.randomUUID();
        UUID requestedBy = UUID.randomUUID();

        when(userRepository.findById(fakeId)).thenReturn(Optional.empty());

        assertThrows(IllegalArgumentException.class,
                () -> anonymizationService.anonymizeUser(fakeId, requestedBy));
        verify(userRepository, never()).save(any());
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
            setField(Role.class, role, "name", roleName);
            setField(Role.class, role, "id", UUID.randomUUID());
            return role;
        } catch (Exception e) {
            throw new RuntimeException(e);
        }
    }
}
