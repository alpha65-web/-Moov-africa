package com.moov.pim.permissions.service;

import com.moov.pim.permissions.api.dto.LoginRequest;
import com.moov.pim.permissions.api.dto.LoginResponse;
import com.moov.pim.permissions.api.dto.RegisterRequest;
import com.moov.pim.permissions.api.dto.UserResponse;
import com.moov.pim.permissions.domain.Permission;
import com.moov.pim.permissions.domain.Role;
import com.moov.pim.permissions.domain.RoleName;
import com.moov.pim.permissions.domain.User;
import com.moov.pim.permissions.repository.RoleRepository;
import com.moov.pim.permissions.repository.UserRepository;
import com.moov.pim.permissions.security.JwtTokenProvider;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.crypto.password.PasswordEncoder;

import java.lang.reflect.Field;
import java.util.Optional;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class AuthServiceTest {

    @Mock private UserRepository userRepository;
    @Mock private RoleRepository roleRepository;
    @Mock private PasswordEncoder passwordEncoder;
    @Mock private JwtTokenProvider jwtTokenProvider;
    @Mock private AuthenticationManager authenticationManager;
    @Mock private ApplicationEventPublisher eventPublisher;

    @InjectMocks
    private AuthService authService;

    private Role adminRole;
    private User testUser;

    @BeforeEach
    void setUp() throws Exception {
        adminRole = createRole(RoleName.ADMIN_SYSTEME);

        testUser = new User("admin@moov-africa.bf", "$2a$10$hash", "Admin", "Test", adminRole);
        Field userIdField = User.class.getDeclaredField("id");
        userIdField.setAccessible(true);
        userIdField.set(testUser, UUID.randomUUID());
    }

    @Test
    void login_shouldReturnTokens() {
        LoginRequest request = new LoginRequest("admin@moov-africa.bf", "password");

        when(authenticationManager.authenticate(any())).thenReturn(
                new UsernamePasswordAuthenticationToken("admin@moov-africa.bf", "password"));
        when(userRepository.findByEmail("admin@moov-africa.bf")).thenReturn(Optional.of(testUser));
        when(jwtTokenProvider.generateAccessToken(any(), any(), any())).thenReturn("access-token");
        when(jwtTokenProvider.generateRefreshToken(any(), any(), any())).thenReturn("refresh-token");

        LoginResponse response = authService.login(request);

        assertEquals("access-token", response.accessToken());
        assertEquals("refresh-token", response.refreshToken());
        assertEquals("admin@moov-africa.bf", response.user().email());
        assertEquals(0, testUser.getFailedLoginAttempts());
        verify(authenticationManager).authenticate(any(UsernamePasswordAuthenticationToken.class));
    }

    @Test
    void login_shouldThrowOnBadCredentials() {
        LoginRequest request = new LoginRequest("admin@moov-africa.bf", "mauvais");

        when(authenticationManager.authenticate(any()))
                .thenThrow(new BadCredentialsException("Bad credentials"));

        assertThrows(BadCredentialsException.class, () -> authService.login(request));
    }

    @Test
    void register_shouldCreateUser() {
        RegisterRequest request = new RegisterRequest(
                "nouveau@moov.bf", "password123", "Nouveau", "Utilisateur", "CHEF_PRODUIT");

        Role chefRole;
        try {
            chefRole = createRole(RoleName.CHEF_PRODUIT);
        } catch (Exception e) { throw new RuntimeException(e); }

        when(userRepository.existsByEmail("nouveau@moov.bf")).thenReturn(false);
        when(roleRepository.findByName(RoleName.CHEF_PRODUIT)).thenReturn(Optional.of(chefRole));
        when(passwordEncoder.encode("password123")).thenReturn("$2a$10$encoded");
        when(userRepository.save(any(User.class))).thenAnswer(inv -> {
            User u = inv.getArgument(0);
            Field idField = User.class.getDeclaredField("id");
            idField.setAccessible(true);
            idField.set(u, UUID.randomUUID());
            return u;
        });

        UserResponse response = authService.register(request);

        assertNotNull(response);
        assertEquals("nouveau@moov.bf", response.email());
        verify(passwordEncoder).encode("password123");
    }

    @Test
    void register_shouldThrowIfEmailExists() {
        RegisterRequest request = new RegisterRequest(
                "existant@moov.bf", "password123", "A", "B", "CHEF_PRODUIT");

        when(userRepository.existsByEmail("existant@moov.bf")).thenReturn(true);

        IllegalArgumentException ex = assertThrows(IllegalArgumentException.class,
                () -> authService.register(request));
        assertTrue(ex.getMessage().contains("existe déjà"));
    }

    @Test
    void register_shouldThrowIfRoleNotFound() {
        RegisterRequest request = new RegisterRequest(
                "new@moov.bf", "password123", "A", "B", "CHEF_PRODUIT");

        when(userRepository.existsByEmail("new@moov.bf")).thenReturn(false);
        when(roleRepository.findByName(RoleName.CHEF_PRODUIT)).thenReturn(Optional.empty());

        assertThrows(IllegalArgumentException.class, () -> authService.register(request));
    }

    @Test
    void refreshToken_shouldReturnNewTokens() {
        when(jwtTokenProvider.validateToken("valid-refresh")).thenReturn(true);
        when(jwtTokenProvider.getEmailFromToken("valid-refresh")).thenReturn("admin@moov-africa.bf");
        when(userRepository.findByEmail("admin@moov-africa.bf")).thenReturn(Optional.of(testUser));
        when(jwtTokenProvider.generateAccessToken(any(), any(), any())).thenReturn("new-access");
        when(jwtTokenProvider.generateRefreshToken(any(), any(), any())).thenReturn("new-refresh");

        LoginResponse response = authService.refreshToken("valid-refresh");

        assertEquals("new-access", response.accessToken());
        assertEquals("new-refresh", response.refreshToken());
    }

    @Test
    void refreshToken_shouldThrowOnInvalidToken() {
        when(jwtTokenProvider.validateToken("invalid")).thenReturn(false);

        assertThrows(IllegalArgumentException.class, () -> authService.refreshToken("invalid"));
    }

    private static Role createRole(RoleName roleName) throws Exception {
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
    }
}
