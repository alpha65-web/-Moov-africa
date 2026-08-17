package com.moov.pim.permissions.service;

import com.moov.pim.permissions.api.dto.ChangePasswordRequest;
import com.moov.pim.permissions.api.dto.LoginRequest;
import com.moov.pim.permissions.api.dto.LoginResponse;
import com.moov.pim.permissions.api.dto.RegisterRequest;
import com.moov.pim.permissions.api.dto.TotpSetupResponse;
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
import com.moov.pim.shared.event.LoginFailedEvent;
import com.moov.pim.shared.event.UserLoginEvent;
import com.moov.pim.shared.event.UserRegisteredEvent;
import com.moov.pim.shared.logging.SecurityMetricsService;
import com.moov.pim.shared.security.EncryptionService;
import com.moov.pim.permissions.security.PasswordPolicyService;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.UUID;

@Service
public class AuthService {

    private final UserRepository userRepository;
    private final RoleRepository roleRepository;
    private final RefreshTokenRepository refreshTokenRepository;
    private final PasswordEncoder passwordEncoder;
    private final JwtTokenProvider jwtTokenProvider;
    private final AuthenticationManager authenticationManager;
    private final ApplicationEventPublisher eventPublisher;
    private final TotpService totpService;
    private final SecurityMetricsService metricsService;
    private final EncryptionService encryptionService;
    private final PasswordPolicyService passwordPolicyService;

    public AuthService(UserRepository userRepository, RoleRepository roleRepository,
                       RefreshTokenRepository refreshTokenRepository,
                       PasswordEncoder passwordEncoder, JwtTokenProvider jwtTokenProvider,
                       AuthenticationManager authenticationManager,
                       ApplicationEventPublisher eventPublisher,
                       TotpService totpService,
                       SecurityMetricsService metricsService,
                       EncryptionService encryptionService,
                       PasswordPolicyService passwordPolicyService) {
        this.userRepository = userRepository;
        this.roleRepository = roleRepository;
        this.refreshTokenRepository = refreshTokenRepository;
        this.passwordEncoder = passwordEncoder;
        this.jwtTokenProvider = jwtTokenProvider;
        this.authenticationManager = authenticationManager;
        this.eventPublisher = eventPublisher;
        this.totpService = totpService;
        this.metricsService = metricsService;
        this.encryptionService = encryptionService;
        this.passwordPolicyService = passwordPolicyService;
    }

    private static final int MAX_FAILED_ATTEMPTS = 5;

    @Transactional
    public LoginResponse login(LoginRequest request, String ipAddress, String userAgent) {
        User user = userRepository.findByEmail(request.email()).orElse(null);

        if (user != null && user.getStatus() == AccountStatus.LOCKED) {
            metricsService.recordLoginFailed();
            metricsService.recordAccountLockout();
            eventPublisher.publishEvent(new LoginFailedEvent(
                    user.getId(), request.email(), "ACCOUNT_LOCKED", ipAddress, userAgent));
            throw new org.springframework.security.authentication.LockedException(
                    "Compte verrouillé après trop de tentatives");
        }

        try {
            authenticationManager.authenticate(
                    new UsernamePasswordAuthenticationToken(request.email(), request.password()));
        } catch (BadCredentialsException ex) {
            UUID failedUserId = null;
            if (user != null) {
                failedUserId = user.getId();
                user.setFailedLoginAttempts(user.getFailedLoginAttempts() + 1);
                if (user.getFailedLoginAttempts() >= MAX_FAILED_ATTEMPTS) {
                    user.setStatus(AccountStatus.LOCKED);
                    metricsService.recordAccountLockout();
                }
                userRepository.save(user);
            }
            metricsService.recordLoginFailed();
            eventPublisher.publishEvent(new LoginFailedEvent(
                    failedUserId, request.email(), "BAD_CREDENTIALS", ipAddress, userAgent));
            throw ex;
        }

        if (user == null) {
            throw new IllegalArgumentException("Utilisateur introuvable");
        }

        if (user.isTotpEnabled()) {
            metricsService.recordMfaChallenge();
            if (request.totpCode() == null || request.totpCode().isBlank()) {
                throw new MfaRequiredException();
            }
            String decryptedSecret = encryptionService.decrypt(user.getTotpSecret());
            if (!totpService.verifyCode(decryptedSecret, request.totpCode())) {
                metricsService.recordMfaFailure();
                eventPublisher.publishEvent(new LoginFailedEvent(
                        user.getId(), request.email(), "INVALID_MFA", ipAddress, userAgent));
                throw new BadCredentialsException("Code MFA invalide");
            }
        }

        user.setFailedLoginAttempts(0);
        user.setLastLoginAt(LocalDateTime.now());

        String fingerprint = jwtTokenProvider.generateFingerprint();
        String fingerprintHash = jwtTokenProvider.hashFingerprint(fingerprint);

        String accessToken = jwtTokenProvider.generateAccessToken(
                user.getId(), user.getEmail(), user.getRole().getName().name(), user.getTokenVersion(), fingerprintHash);
        String refreshToken = jwtTokenProvider.generateRefreshToken(
                user.getId(), user.getEmail(), user.getRole().getName().name(), user.getTokenVersion(), fingerprintHash);

        storeRefreshToken(user.getId(), refreshToken);

        metricsService.recordLoginSuccess();
        eventPublisher.publishEvent(new UserLoginEvent(user.getId(), user.getEmail(), ipAddress, userAgent));
        return new LoginResponse(accessToken, refreshToken, fingerprint, UserResponse.from(user));
    }

    @Transactional
    public TotpSetupResponse setupTotp(UUID userId) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new IllegalArgumentException("Utilisateur introuvable"));

        if (user.isTotpEnabled()) {
            throw new IllegalStateException("MFA déjà activé");
        }

        String secret = totpService.generateSecret();
        user.setTotpSecret(encryptionService.encrypt(secret));
        userRepository.save(user);

        String uri = totpService.buildOtpAuthUri(secret, user.getEmail());
        return new TotpSetupResponse(secret, uri);
    }

    @Transactional
    public void enableTotp(UUID userId, String code) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new IllegalArgumentException("Utilisateur introuvable"));

        if (user.getTotpSecret() == null) {
            throw new IllegalStateException("Configurez d'abord le MFA avec /auth/totp/setup");
        }

        String decryptedSecret = encryptionService.decrypt(user.getTotpSecret());
        if (!totpService.verifyCode(decryptedSecret, code)) {
            throw new BadCredentialsException("Code MFA invalide — vérifiez votre application d'authentification");
        }

        user.setTotpEnabled(true);
        userRepository.save(user);
    }

    @Transactional
    public void disableTotp(UUID userId, String code) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new IllegalArgumentException("Utilisateur introuvable"));

        if (!user.isTotpEnabled()) {
            throw new IllegalStateException("MFA non activé");
        }

        String decryptedSecret = encryptionService.decrypt(user.getTotpSecret());
        if (!totpService.verifyCode(decryptedSecret, code)) {
            throw new BadCredentialsException("Code MFA invalide");
        }

        user.setTotpEnabled(false);
        user.setTotpSecret(null);
        userRepository.save(user);
    }

    @Transactional
    public UserResponse register(RegisterRequest request) {
        passwordPolicyService.validate(request.password());

        if (userRepository.existsByEmail(request.email())) {
            throw new IllegalArgumentException("Un compte existe déjà avec cet email");
        }

        RoleName roleName = RoleName.valueOf(request.roleName());
        Role role = roleRepository.findByName(roleName)
                .orElseThrow(() -> new IllegalArgumentException("Rôle introuvable : " + request.roleName()));

        User user = new User(
                request.email(),
                passwordEncoder.encode(request.password()),
                request.firstName(),
                request.lastName(),
                request.sex(),
                role
        );

        user = userRepository.save(user);
        eventPublisher.publishEvent(new UserRegisteredEvent(user.getId(), user.getEmail()));
        return UserResponse.from(user);
    }

    @Transactional
    public LoginResponse refreshToken(String refreshToken) {
        if (!jwtTokenProvider.validateToken(refreshToken)) {
            throw new IllegalArgumentException("Refresh token invalide ou expiré");
        }

        if (!"refresh".equals(jwtTokenProvider.getTokenType(refreshToken))) {
            throw new IllegalArgumentException("Token de type invalide");
        }

        String tokenHash = JwtTokenProvider.hashToken(refreshToken);
        RefreshToken stored = refreshTokenRepository.findByTokenHashAndRevokedFalse(tokenHash)
                .orElseThrow(() -> new IllegalArgumentException("Refresh token révoqué ou inconnu"));

        String email = jwtTokenProvider.getEmailFromToken(refreshToken);
        User user = userRepository.findByEmail(email)
                .orElseThrow(() -> new IllegalArgumentException("Utilisateur introuvable"));

        if (user.getStatus() != AccountStatus.ACTIVE) {
            throw new IllegalStateException("Compte désactivé ou verrouillé");
        }

        int tokenVersion = jwtTokenProvider.getTokenVersionFromToken(refreshToken);
        if (tokenVersion != user.getTokenVersion()) {
            stored.setRevoked(true);
            refreshTokenRepository.save(stored);
            throw new IllegalArgumentException("Token révoqué suite à un changement de mot de passe");
        }

        stored.setRevoked(true);
        refreshTokenRepository.save(stored);

        String fingerprint = jwtTokenProvider.generateFingerprint();
        String fingerprintHash = jwtTokenProvider.hashFingerprint(fingerprint);

        String newAccessToken = jwtTokenProvider.generateAccessToken(
                user.getId(), user.getEmail(), user.getRole().getName().name(), user.getTokenVersion(), fingerprintHash);
        String newRefreshToken = jwtTokenProvider.generateRefreshToken(
                user.getId(), user.getEmail(), user.getRole().getName().name(), user.getTokenVersion(), fingerprintHash);

        storeRefreshToken(user.getId(), newRefreshToken);
        metricsService.recordTokenRefresh();

        return new LoginResponse(newAccessToken, newRefreshToken, fingerprint, UserResponse.from(user));
    }

    @Transactional
    public LoginResponse changePassword(UUID userId, ChangePasswordRequest request) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new IllegalArgumentException("Utilisateur introuvable"));

        if (!passwordEncoder.matches(request.currentPassword(), user.getPasswordHash())) {
            throw new BadCredentialsException("Mot de passe actuel incorrect");
        }

        if (passwordEncoder.matches(request.newPassword(), user.getPasswordHash())) {
            throw new IllegalArgumentException("Le nouveau mot de passe doit être différent de l'ancien");
        }

        passwordPolicyService.validate(request.newPassword());

        user.setPasswordHash(passwordEncoder.encode(request.newPassword()));
        user.incrementTokenVersion();
        user.setForcePasswordChange(false);
        userRepository.save(user);

        refreshTokenRepository.revokeAllByUserId(userId);

        String fingerprint = jwtTokenProvider.generateFingerprint();
        String fingerprintHash = jwtTokenProvider.hashFingerprint(fingerprint);

        String accessToken = jwtTokenProvider.generateAccessToken(
                user.getId(), user.getEmail(), user.getRole().getName().name(), user.getTokenVersion(), fingerprintHash);
        String refreshToken = jwtTokenProvider.generateRefreshToken(
                user.getId(), user.getEmail(), user.getRole().getName().name(), user.getTokenVersion(), fingerprintHash);

        storeRefreshToken(user.getId(), refreshToken);

        return new LoginResponse(accessToken, refreshToken, fingerprint, UserResponse.from(user));
    }

    @Transactional
    public void logout(UUID userId, String refreshToken) {
        if (refreshToken != null && jwtTokenProvider.validateToken(refreshToken)) {
            String tokenHash = JwtTokenProvider.hashToken(refreshToken);
            refreshTokenRepository.findByTokenHashAndRevokedFalse(tokenHash)
                    .ifPresent(stored -> {
                        stored.setRevoked(true);
                        refreshTokenRepository.save(stored);
                    });
        }
    }

    private void storeRefreshToken(UUID userId, String refreshToken) {
        String tokenHash = JwtTokenProvider.hashToken(refreshToken);
        long expirationMs = jwtTokenProvider.getRefreshTokenExpiration();
        LocalDateTime expiresAt = LocalDateTime.now().plusSeconds(expirationMs / 1000);
        refreshTokenRepository.save(new RefreshToken(userId, tokenHash, expiresAt));
    }

    public static class MfaRequiredException extends RuntimeException {
        public MfaRequiredException() {
            super("MFA_REQUIRED");
        }
    }
}
