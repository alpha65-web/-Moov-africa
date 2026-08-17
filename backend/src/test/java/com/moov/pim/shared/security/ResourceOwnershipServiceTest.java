package com.moov.pim.shared.security;

import com.moov.pim.permissions.domain.Permission;
import com.moov.pim.permissions.domain.Role;
import com.moov.pim.permissions.domain.RoleName;
import com.moov.pim.permissions.domain.User;
import com.moov.pim.permissions.security.CustomUserDetails;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;

import java.lang.reflect.Field;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;

class ResourceOwnershipServiceTest {

    private ResourceOwnershipService ownershipService;
    private UUID userId;

    @BeforeEach
    void setUp() {
        ownershipService = new ResourceOwnershipService();
        userId = UUID.randomUUID();
    }

    @AfterEach
    void tearDown() {
        SecurityContextHolder.clearContext();
    }

    @Test
    void isOwnerOrAdmin_shouldReturnTrueIfOwner() throws Exception {
        setUpAuth(userId, RoleName.CHEF_PRODUIT, false);

        assertTrue(ownershipService.isOwnerOrAdmin(userId));
    }

    @Test
    void isOwnerOrAdmin_shouldReturnFalseIfNotOwnerAndNoPermission() throws Exception {
        setUpAuth(userId, RoleName.CHEF_PRODUIT, false);
        UUID otherUserId = UUID.randomUUID();

        assertFalse(ownershipService.isOwnerOrAdmin(otherUserId));
    }

    @Test
    void isOwnerOrAdmin_shouldReturnTrueIfHasUserManagePermission() throws Exception {
        setUpAuth(userId, RoleName.ADMIN_SYSTEME, true);
        UUID otherUserId = UUID.randomUUID();

        assertTrue(ownershipService.isOwnerOrAdmin(otherUserId));
    }

    @Test
    void isOwnerOrAdmin_shouldReturnFalseIfUnauthenticated() {
        assertFalse(ownershipService.isOwnerOrAdmin(UUID.randomUUID()));
    }

    @Test
    void currentUserId_shouldReturnId() throws Exception {
        setUpAuth(userId, RoleName.CHEF_PRODUIT, false);

        assertEquals(userId, ownershipService.currentUserId());
    }

    @Test
    void currentUserId_shouldThrowIfUnauthenticated() {
        assertThrows(SecurityException.class, () -> ownershipService.currentUserId());
    }

    private void setUpAuth(UUID uid, RoleName roleName, boolean withUserManage) throws Exception {
        Role role = createRole(roleName);
        if (withUserManage) {
            Permission perm = new Permission("USER_MANAGE", "Manage users");
            setField(Permission.class, perm, "id", UUID.randomUUID());
            role.getPermissions().add(perm);
        }
        User user = new User("user@moov.bf", "$2a$hash", "U", "Ser", role);
        setField(User.class, user, "id", uid);

        CustomUserDetails details = new CustomUserDetails(user);
        SecurityContextHolder.getContext().setAuthentication(
                new UsernamePasswordAuthenticationToken(details, null, details.getAuthorities()));
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
