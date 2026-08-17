package com.moov.pim.permissions.security;

import com.moov.pim.permissions.domain.Role;
import com.moov.pim.permissions.domain.RoleName;
import com.moov.pim.permissions.domain.User;
import com.moov.pim.permissions.repository.UserRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.security.core.userdetails.UsernameNotFoundException;

import java.lang.reflect.Field;
import java.util.Optional;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class CustomUserDetailsServiceTest {

    @Mock private UserRepository userRepository;

    @InjectMocks private CustomUserDetailsService userDetailsService;

    @Test
    void loadUserByUsername_shouldReturnUserDetails() throws Exception {
        Role role = createRole(RoleName.CHEF_PRODUIT);
        User user = new User("chef@moov.bf", "$2a$hash", "Chef", "Produit", role);
        setField(User.class, user, "id", UUID.randomUUID());

        when(userRepository.findByEmail("chef@moov.bf")).thenReturn(Optional.of(user));

        UserDetails details = userDetailsService.loadUserByUsername("chef@moov.bf");

        assertNotNull(details);
        assertEquals("chef@moov.bf", details.getUsername());
        assertInstanceOf(CustomUserDetails.class, details);
        assertEquals(user.getId(), ((CustomUserDetails) details).getUserId());
    }

    @Test
    void loadUserByUsername_shouldThrowIfNotFound() {
        when(userRepository.findByEmail("inconnu@moov.bf")).thenReturn(Optional.empty());

        UsernameNotFoundException ex = assertThrows(UsernameNotFoundException.class,
                () -> userDetailsService.loadUserByUsername("inconnu@moov.bf"));
        assertTrue(ex.getMessage().contains("inconnu@moov.bf"));
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

    private static Role createRole(RoleName roleName) throws Exception {
        var constructor = Role.class.getDeclaredConstructor();
        constructor.setAccessible(true);
        Role role = constructor.newInstance();
        setField(Role.class, role, "name", roleName);
        setField(Role.class, role, "id", UUID.randomUUID());
        return role;
    }
}
