package com.moov.pim.permissions.service;

import com.moov.pim.permissions.api.dto.ChangePasswordRequest;
import com.moov.pim.permissions.api.dto.LoginRequest;
import com.moov.pim.permissions.api.dto.LoginResponse;
import com.moov.pim.permissions.api.dto.RegisterRequest;
import com.moov.pim.permissions.api.dto.UserResponse;
import com.moov.pim.permissions.domain.AccountStatus;
import com.moov.pim.permissions.domain.RefreshToken;
import com.moov.pim.permissions.domain.Role;
import com.moov.pim.permissions.domain.RoleName;
import com.moov.pim.permissions.domain.User;
import com.moov.pim.permissions.repository.RefreshTokenRepository;
import com.moov.pim.permissions.repository.RoleRepository;
import com.moov.pim.permissions.repository.UserRepository;
import com.moov.pim.permissions.security.JwtTokenProvider;
import com.moov.pim.permissions.security.PasswordPolicyService;
import com.moov.pim.shared.logging.SecurityMetricsService;
import com.moov.pim.shared.security.EncryptionService;
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
import java.time.LocalDateTime;
import java.util.Optional;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class AuthServiceTest {

    @Mock private UserRepository userRepository;
    @Mock private RoleRepository roleRepository;
    @Mock private RefreshTokenRepository refreshTokenRepository;
    @Mock private PasswordEncoder passwordEncoder;
    @Mock private JwtTokenProvider jwtTokenProvider;
    @Mock private AuthenticationManager authenticationManager;
    @Mock private ApplicationEventPublisher eventPublisher;
    @Mock private TotpService totpService;
    @Mock private SecurityMetricsService metricsService;
    @Mock private EncryptionService encryptionService;
    @Mock private PasswordPolicyService passwordPolicyService;

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
        LoginRequest request = new LoginRequest("admin@moov-africa.bf", "password", null);

        when(authenticationManager.authenticate(any())).thenReturn(
                new UsernamePasswordAuthenticationToken("admin@moov-africa.bf", "password"));
        when(userRepository.findByEmail("admin@moov-africa.bf")).thenReturn(Optional.of(testUser));
        when(jwtTokenProvider.generateFingerprint()).thenReturn("fingerprint-hex");
        when(jwtTokenProvider.hashFingerprint("fingerprint-hex")).thenReturn("hashed-fp");
        when(jwtTokenProvider.generateAccessToken(any(), any(), any(), anyInt(), any())).thenReturn("access-token");
        when(jwtTokenProvider.generateRefreshToken(any(), any(), any(), anyInt(), any())).thenReturn("refresh-token");
        when(jwtTokenProvider.getRefreshTokenExpiration()).thenReturn(604800000L);

        LoginResponse response = authService.login(request, "127.0.0.1", "TestAgent");

        assertEquals("access-token", response.accessToken());
        assertEquals("refresh-token", response.refreshToken());
        assertEquals("fingerprint-hex", response.fingerprint());
        assertEquals("admin@moov-africa.bf", response.user().email());
        assertEquals(0, testUser.getFailedLoginAttempts());
        verify(authenticationManager).authenticate(any(UsernamePasswordAuthenticationToken.class));
        verify(refreshTokenRepository).save(any());
    }

    @Test
    void login_shouldThrowOnBadCredentials() {
        LoginRequest request = new LoginRequest("admin@moov-africa.bf", "mauvais", null);

        when(userRepository.findByEmail("admin@moov-africa.bf")).thenReturn(Optional.of(testUser));
        when(authenticationManager.authenticate(any()))
                .thenThrow(new BadCredentialsException("Bad credentials"));

        assertThrows(BadCredentialsException.class,
                () -> authService.login(request, "127.0.0.1", "TestAgent"));
    }

    @Test
    void register_shouldCreateUser() {
        RegisterRequest request = new RegisterRequest(
                "nouveau@moov.bf", "password12345", "Nouveau", "Utilisateur", "CHEF_PRODUIT");

        Role chefRole;
        try {
            chefRole = createRole(RoleName.CHEF_PRODUIT);
        } catch (Exception e) { throw new RuntimeException(e); }

        when(userRepository.existsByEmail("nouveau@moov.bf")).thenReturn(false);
        when(roleRepository.findByName(RoleName.CHEF_PRODUIT)).thenReturn(Optional.of(chefRole));
        when(passwordEncoder.encode("password12345")).thenReturn("$2a$10$encoded");
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
        verify(passwordEncoder).encode("password12345");
        verify(passwordPolicyService).validate("password12345");
    }

    @Test
    void register_shouldThrowIfEmailExists() {
        RegisterRequest request = new RegisterRequest(
                "existant@moov.bf", "password12345", "A", "B", "CHEF_PRODUIT");

        when(userRepository.existsByEmail("existant@moov.bf")).thenReturn(true);

        IllegalArgumentException ex = assertThrows(IllegalArgumentException.class,
                () -> authService.register(request));
        assertTrue(ex.getMessage().contains("existe déjà"));
    }

    @Test
    void register_shouldThrowIfRoleNotFound() {
        RegisterRequest request = new RegisterRequest(
                "new@moov.bf", "password12345", "A", "B", "CHEF_PRODUIT");

        when(userRepository.existsByEmail("new@moov.bf")).thenReturn(false);
        when(roleRepository.findByName(RoleName.CHEF_PRODUIT)).thenReturn(Optional.empty());

        assertThrows(IllegalArgumentException.class, () -> authService.register(request));
    }

    @Test
    void changePassword_shouldInvalidateOldTokens() {
        UUID userId = testUser.getId();
        ChangePasswordRequest request = new ChangePasswordRequest("oldPassword", "newPassword12");

        when(userRepository.findById(userId)).thenReturn(Optional.of(testUser));
        when(passwordEncoder.matches("oldPassword", "$2a$10$hash")).thenReturn(true);
        when(passwordEncoder.matches("newPassword12", "$2a$10$hash")).thenReturn(false);
        when(passwordEncoder.encode("newPassword12")).thenReturn("$2a$10$newhash");
        when(userRepository.save(any(User.class))).thenReturn(testUser);
        when(jwtTokenProvider.generateFingerprint()).thenReturn("fp");
        when(jwtTokenProvider.hashFingerprint("fp")).thenReturn("hfp");
        when(jwtTokenProvider.generateAccessToken(any(), any(), any(), anyInt(), any())).thenReturn("new-access");
        when(jwtTokenProvider.generateRefreshToken(any(), any(), any(), anyInt(), any())).thenReturn("new-refresh");
        when(jwtTokenProvider.getRefreshTokenExpiration()).thenReturn(604800000L);

        LoginResponse response = authService.changePassword(userId, request);

        assertNotNull(response);
        verify(refreshTokenRepository).revokeAllByUserId(userId);
        assertEquals(1, testUser.getTokenVersion());
        assertFalse(testUser.isForcePasswordChange());
    }

    @Test
    void changePassword_shouldThrowOnWrongCurrentPassword() {
        UUID userId = testUser.getId();
        ChangePasswordRequest request = new ChangePasswordRequest("wrong", "newPassword12");

        when(userRepository.findById(userId)).thenReturn(Optional.of(testUser));
        when(passwordEncoder.matches("wrong", "$2a$10$hash")).thenReturn(false);

        assertThrows(BadCredentialsException.class, () -> authService.changePassword(userId, request));
    }

    @Test
    void refreshToken_shouldRotateTokens() {
        String oldRefresh = "old-refresh-token";
        String tokenHash = JwtTokenProvider.hashToken(oldRefresh);
        RefreshToken stored = new RefreshToken(testUser.getId(), tokenHash, LocalDateTime.now().plusDays(7));

        when(jwtTokenProvider.validateToken(oldRefresh)).thenReturn(true);
        when(jwtTokenProvider.getTokenType(oldRefresh)).thenReturn("refresh");
        when(jwtTokenProvider.getEmailFromToken(oldRefresh)).thenReturn("admin@moov-africa.bf");
        when(jwtTokenProvider.getTokenVersionFromToken(oldRefresh)).thenReturn(0);
        when(refreshTokenRepository.findByTokenHashAndRevokedFalse(tokenHash)).thenReturn(Optional.of(stored));
        when(userRepository.findByEmail("admin@moov-africa.bf")).thenReturn(Optional.of(testUser));
        when(jwtTokenProvider.generateFingerprint()).thenReturn("fp");
        when(jwtTokenProvider.hashFingerprint("fp")).thenReturn("hfp");
        when(jwtTokenProvider.generateAccessToken(any(), any(), any(), anyInt(), any())).thenReturn("new-access");
        when(jwtTokenProvider.generateRefreshToken(any(), any(), any(), anyInt(), any())).thenReturn("new-refresh");
        when(jwtTokenProvider.getRefreshTokenExpiration()).thenReturn(604800000L);
        when(refreshTokenRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));

        LoginResponse response = authService.refreshToken(oldRefresh);

        assertEquals("new-access", response.accessToken());
        assertEquals("new-refresh", response.refreshToken());
        assertTrue(stored.isRevoked());
    }

    @Test
    void refreshToken_shouldThrowOnRevokedToken() {
        String refreshToken = "revoked-refresh";
        String tokenHash = JwtTokenProvider.hashToken(refreshToken);

        when(jwtTokenProvider.validateToken(refreshToken)).thenReturn(true);
        when(jwtTokenProvider.getTokenType(refreshToken)).thenReturn("refresh");
        when(refreshTokenRepository.findByTokenHashAndRevokedFalse(tokenHash)).thenReturn(Optional.empty());

        assertThrows(IllegalArgumentException.class, () -> authService.refreshToken(refreshToken));
    }

    @Test
    void refreshToken_shouldThrowOnAccessTokenType() {
        String token = "access-token-as-refresh";

        when(jwtTokenProvider.validateToken(token)).thenReturn(true);
        when(jwtTokenProvider.getTokenType(token)).thenReturn("access");

        assertThrows(IllegalArgumentException.class, () -> authService.refreshToken(token));
    }

    @Test
    void logout_shouldRevokeRefreshToken() {
        String refreshToken = "logout-refresh";
        String tokenHash = JwtTokenProvider.hashToken(refreshToken);
        RefreshToken stored = new RefreshToken(testUser.getId(), tokenHash, LocalDateTime.now().plusDays(7));

        when(jwtTokenProvider.validateToken(refreshToken)).thenReturn(true);
        when(refreshTokenRepository.findByTokenHashAndRevokedFalse(tokenHash)).thenReturn(Optional.of(stored));

        authService.logout(testUser.getId(), refreshToken);

        assertTrue(stored.isRevoked());
        verify(refreshTokenRepository).save(stored);
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
