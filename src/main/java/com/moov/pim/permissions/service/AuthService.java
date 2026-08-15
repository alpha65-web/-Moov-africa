package com.moov.pim.permissions.service;

import com.moov.pim.permissions.api.dto.LoginRequest;
import com.moov.pim.permissions.api.dto.LoginResponse;
import com.moov.pim.permissions.api.dto.RegisterRequest;
import com.moov.pim.permissions.api.dto.UserResponse;
import com.moov.pim.permissions.domain.AccountStatus;
import com.moov.pim.permissions.domain.Role;
import com.moov.pim.permissions.domain.RoleName;
import com.moov.pim.permissions.domain.User;
import com.moov.pim.permissions.repository.RoleRepository;
import com.moov.pim.permissions.repository.UserRepository;
import com.moov.pim.permissions.security.JwtTokenProvider;
import com.moov.pim.shared.event.UserLoginEvent;
import com.moov.pim.shared.event.UserRegisteredEvent;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;

@Service
public class AuthService {

    private final UserRepository userRepository;
    private final RoleRepository roleRepository;
    private final PasswordEncoder passwordEncoder;
    private final JwtTokenProvider jwtTokenProvider;
    private final AuthenticationManager authenticationManager;
    private final ApplicationEventPublisher eventPublisher;

    public AuthService(UserRepository userRepository, RoleRepository roleRepository,
                       PasswordEncoder passwordEncoder, JwtTokenProvider jwtTokenProvider,
                       AuthenticationManager authenticationManager,
                       ApplicationEventPublisher eventPublisher) {
        this.userRepository = userRepository;
        this.roleRepository = roleRepository;
        this.passwordEncoder = passwordEncoder;
        this.jwtTokenProvider = jwtTokenProvider;
        this.authenticationManager = authenticationManager;
        this.eventPublisher = eventPublisher;
    }

    private static final int MAX_FAILED_ATTEMPTS = 5;

    @Transactional
    public LoginResponse login(LoginRequest request) {
        User user = userRepository.findByEmail(request.email()).orElse(null);

        if (user != null && user.getStatus() == AccountStatus.LOCKED) {
            throw new org.springframework.security.authentication.LockedException(
                    "Compte verrouillé après trop de tentatives");
        }

        try {
            authenticationManager.authenticate(
                    new UsernamePasswordAuthenticationToken(request.email(), request.password()));
        } catch (org.springframework.security.authentication.BadCredentialsException ex) {
            if (user != null) {
                user.setFailedLoginAttempts(user.getFailedLoginAttempts() + 1);
                if (user.getFailedLoginAttempts() >= MAX_FAILED_ATTEMPTS) {
                    user.setStatus(AccountStatus.LOCKED);
                }
                userRepository.save(user);
            }
            throw ex;
        }

        if (user == null) {
            throw new IllegalArgumentException("Utilisateur introuvable");
        }

        user.setFailedLoginAttempts(0);
        user.setLastLoginAt(LocalDateTime.now());

        String accessToken = jwtTokenProvider.generateAccessToken(
                user.getId(), user.getEmail(), user.getRole().getName().name());
        String refreshToken = jwtTokenProvider.generateRefreshToken(
                user.getId(), user.getEmail(), user.getRole().getName().name());

        eventPublisher.publishEvent(new UserLoginEvent(user.getId(), user.getEmail()));
        return new LoginResponse(accessToken, refreshToken, UserResponse.from(user));
    }

    @Transactional
    public UserResponse register(RegisterRequest request) {
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

        String email = jwtTokenProvider.getEmailFromToken(refreshToken);
        User user = userRepository.findByEmail(email)
                .orElseThrow(() -> new IllegalArgumentException("Utilisateur introuvable"));

        if (user.getStatus() != AccountStatus.ACTIVE) {
            throw new IllegalStateException("Compte désactivé ou verrouillé");
        }

        String newAccessToken = jwtTokenProvider.generateAccessToken(
                user.getId(), user.getEmail(), user.getRole().getName().name());
        String newRefreshToken = jwtTokenProvider.generateRefreshToken(
                user.getId(), user.getEmail(), user.getRole().getName().name());

        return new LoginResponse(newAccessToken, newRefreshToken, UserResponse.from(user));
    }
}
