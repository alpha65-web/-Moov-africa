package com.moov.pim.permissions.api;

import com.moov.pim.permissions.domain.AccountStatus;
import com.moov.pim.permissions.domain.Role;
import com.moov.pim.permissions.domain.RoleName;
import com.moov.pim.permissions.domain.User;
import com.moov.pim.permissions.repository.UserRepository;
import com.moov.pim.permissions.security.CustomUserDetails;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.HttpStatus;

import java.lang.reflect.Field;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class UserControllerTest {

    @Mock private UserRepository userRepository;
    @InjectMocks private UserController controller;

    @Test
    void me_shouldReturn200() throws Exception {
        UUID userId = UUID.randomUUID();
        Role role = createRole(RoleName.CHEF_PRODUIT);
        User user = new User("chef@moov.bf", "$2a$hash", "Chef", "Produit", role);
        setField(User.class, user, "id", userId);
        var principal = new CustomUserDetails(user);

        var result = controller.me(principal);

        assertEquals(HttpStatus.OK, result.getStatusCode());
        assertEquals("chef@moov.bf", result.getBody().email());
    }

    @Test
    void list_shouldReturn200() throws Exception {
        Role role = createRole(RoleName.CHEF_PRODUIT);
        User user = new User("user@moov.bf", "$2a$hash", "U", "Ser", role);
        setField(User.class, user, "id", UUID.randomUUID());
        when(userRepository.findAll()).thenReturn(List.of(user));

        var result = controller.list();

        assertEquals(HttpStatus.OK, result.getStatusCode());
        assertEquals(1, result.getBody().size());
    }

    @Test
    void updateStatus_shouldReturn200() throws Exception {
        UUID userId = UUID.randomUUID();
        UUID principalId = UUID.randomUUID();
        Role role = createRole(RoleName.CHEF_PRODUIT);
        User user = new User("user@moov.bf", "$2a$hash", "U", "Ser", role);
        setField(User.class, user, "id", userId);
        user.setStatus(AccountStatus.LOCKED);

        var principal = mock(CustomUserDetails.class);
        when(principal.getUserId()).thenReturn(principalId);
        when(userRepository.findById(userId)).thenReturn(Optional.of(user));
        when(userRepository.save(any(User.class))).thenAnswer(inv -> inv.getArgument(0));

        var result = controller.updateStatus(userId, AccountStatus.ACTIVE, principal);

        assertEquals(HttpStatus.OK, result.getStatusCode());
        assertEquals(AccountStatus.ACTIVE, user.getStatus());
        assertEquals(0, user.getFailedLoginAttempts());
    }

    @Test
    void updateStatus_shouldThrowIfSelfModify() throws Exception {
        UUID userId = UUID.randomUUID();
        var principal = mock(CustomUserDetails.class);
        when(principal.getUserId()).thenReturn(userId);

        assertThrows(IllegalArgumentException.class,
                () -> controller.updateStatus(userId, AccountStatus.LOCKED, principal));
    }

    @Test
    void updateStatus_shouldThrowIfNotFound() {
        UUID userId = UUID.randomUUID();
        UUID principalId = UUID.randomUUID();
        var principal = mock(CustomUserDetails.class);
        when(principal.getUserId()).thenReturn(principalId);
        when(userRepository.findById(userId)).thenReturn(Optional.empty());

        assertThrows(IllegalArgumentException.class,
                () -> controller.updateStatus(userId, AccountStatus.ACTIVE, principal));
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
