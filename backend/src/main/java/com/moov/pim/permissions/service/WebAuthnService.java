package com.moov.pim.permissions.service;

import com.moov.pim.permissions.api.dto.LoginResponse;
import com.moov.pim.permissions.api.dto.UserResponse;
import com.moov.pim.permissions.domain.User;
import com.moov.pim.permissions.domain.WebAuthnCredential;
import com.moov.pim.permissions.repository.UserRepository;
import com.moov.pim.permissions.repository.WebAuthnCredentialRepository;
import com.moov.pim.permissions.security.JwtTokenProvider;
import com.moov.pim.permissions.security.WebAuthnCredentialStore;
import com.moov.pim.shared.logging.SecurityMetricsService;
import com.yubico.webauthn.AssertionRequest;
import com.yubico.webauthn.AssertionResult;
import com.yubico.webauthn.FinishAssertionOptions;
import com.yubico.webauthn.FinishRegistrationOptions;
import com.yubico.webauthn.RegistrationResult;
import com.yubico.webauthn.RelyingParty;
import com.yubico.webauthn.StartAssertionOptions;
import com.yubico.webauthn.StartRegistrationOptions;
import com.yubico.webauthn.data.AuthenticatorAttestationResponse;
import com.yubico.webauthn.data.AuthenticatorSelectionCriteria;
import com.yubico.webauthn.data.ByteArray;
import com.yubico.webauthn.data.ClientRegistrationExtensionOutputs;
import com.yubico.webauthn.data.PublicKeyCredential;
import com.yubico.webauthn.data.PublicKeyCredentialCreationOptions;
import com.yubico.webauthn.data.ResidentKeyRequirement;
import com.yubico.webauthn.data.UserIdentity;
import com.yubico.webauthn.data.UserVerificationRequirement;
import com.yubico.webauthn.exception.AssertionFailedException;
import com.yubico.webauthn.exception.RegistrationFailedException;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.io.IOException;
import java.security.SecureRandom;
import java.time.LocalDateTime;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;
import java.util.stream.Collectors;

@Service
@ConditionalOnProperty(name = "pim.webauthn.enabled", havingValue = "true")
public class WebAuthnService {

    private static final Logger log = LoggerFactory.getLogger(WebAuthnService.class);
    private static final SecureRandom RANDOM = new SecureRandom();

    private final RelyingParty relyingParty;
    private final WebAuthnCredentialRepository credentialRepo;
    private final UserRepository userRepository;
    private final JwtTokenProvider jwtTokenProvider;
    private final SecurityMetricsService metricsService;

    private final Map<String, PendingRegistration> pendingRegistrations = new ConcurrentHashMap<>();
    private final Map<String, PendingAssertion> pendingAssertions = new ConcurrentHashMap<>();

    public WebAuthnService(WebAuthnCredentialStore credentialStore,
                           WebAuthnCredentialRepository credentialRepo,
                           UserRepository userRepository,
                           JwtTokenProvider jwtTokenProvider,
                           SecurityMetricsService metricsService,
                           @Value("${pim.webauthn.rp-id:localhost}") String rpId,
                           @Value("${pim.webauthn.rp-name:Moov Africa PIM}") String rpName,
                           @Value("${pim.webauthn.origin:http://localhost:3000}") String origin) {
        this.credentialRepo = credentialRepo;
        this.userRepository = userRepository;
        this.jwtTokenProvider = jwtTokenProvider;
        this.metricsService = metricsService;

        this.relyingParty = RelyingParty.builder()
                .identity(com.yubico.webauthn.data.RelyingPartyIdentity.builder()
                        .id(rpId)
                        .name(rpName)
                        .build())
                .credentialRepository(credentialStore)
                .origins(java.util.Set.of(origin))
                .build();
    }

    public String startRegistration(UUID userId) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new IllegalArgumentException("Utilisateur introuvable"));

        ByteArray userHandle = generateUserHandle(user);

        PublicKeyCredentialCreationOptions options = relyingParty.startRegistration(
                StartRegistrationOptions.builder()
                        .user(UserIdentity.builder()
                                .name(user.getEmail())
                                .displayName(user.getFirstName() + " " + user.getLastName())
                                .id(userHandle)
                                .build())
                        .authenticatorSelection(AuthenticatorSelectionCriteria.builder()
                                .residentKey(ResidentKeyRequirement.PREFERRED)
                                .userVerification(UserVerificationRequirement.PREFERRED)
                                .build())
                        .build());

        String requestId = UUID.randomUUID().toString();
        pendingRegistrations.put(requestId, new PendingRegistration(options, userId, userHandle));

        try {
            String json = options.toCredentialsCreateJson();
            return "{\"requestId\":\"" + requestId + "\",\"options\":" + json + "}";
        } catch (com.fasterxml.jackson.core.JsonProcessingException e) {
            throw new RuntimeException("Failed to serialize registration options", e);
        }
    }

    @Transactional
    public void finishRegistration(String requestId, String responseJson, String credentialName) {
        PendingRegistration pending = pendingRegistrations.remove(requestId);
        if (pending == null) {
            throw new IllegalArgumentException("Registration request expired or invalid");
        }

        try {
            PublicKeyCredential<AuthenticatorAttestationResponse, ClientRegistrationExtensionOutputs> credential =
                    PublicKeyCredential.parseRegistrationResponseJson(responseJson);

            RegistrationResult result = relyingParty.finishRegistration(
                    FinishRegistrationOptions.builder()
                            .request(pending.options)
                            .response(credential)
                            .build());

            String transports = credential.getResponse().getTransports().stream()
                    .map(t -> t.getId())
                    .collect(Collectors.joining(","));

            WebAuthnCredential saved = new WebAuthnCredential(
                    pending.userId,
                    result.getKeyId().getId().getBase64Url(),
                    result.getPublicKeyCose().getBase64Url(),
                    result.getSignatureCount(),
                    pending.userHandle.getBase64Url(),
                    credentialName != null ? credentialName : "Passkey",
                    transports,
                    result.isDiscoverable().orElse(false)
            );
            credentialRepo.save(saved);

            log.info("WebAuthn credential registered for user {}", pending.userId);

        } catch (RegistrationFailedException | IOException e) {
            throw new IllegalArgumentException("WebAuthn registration failed: " + e.getMessage(), e);
        }
    }

    public String startAssertion(String email) {
        StartAssertionOptions.StartAssertionOptionsBuilder builder = StartAssertionOptions.builder()
                .userVerification(UserVerificationRequirement.PREFERRED);

        if (email != null && !email.isBlank()) {
            builder.username(email);
        }

        AssertionRequest request = relyingParty.startAssertion(builder.build());

        String requestId = UUID.randomUUID().toString();
        pendingAssertions.put(requestId, new PendingAssertion(request));

        try {
            String json = request.toCredentialsGetJson();
            return "{\"requestId\":\"" + requestId + "\",\"options\":" + json + "}";
        } catch (com.fasterxml.jackson.core.JsonProcessingException e) {
            throw new RuntimeException("Failed to serialize assertion options", e);
        }
    }

    @Transactional
    public LoginResponse finishAssertion(String requestId, String responseJson) {
        PendingAssertion pending = pendingAssertions.remove(requestId);
        if (pending == null) {
            throw new IllegalArgumentException("Assertion request expired or invalid");
        }

        try {
            AssertionResult result = relyingParty.finishAssertion(
                    FinishAssertionOptions.builder()
                            .request(pending.request)
                            .response(PublicKeyCredential.parseAssertionResponseJson(responseJson))
                            .build());

            if (!result.isSuccess()) {
                metricsService.recordLoginFailed();
                throw new IllegalArgumentException("WebAuthn assertion failed");
            }

            credentialRepo.findByCredentialId(result.getCredential().getCredentialId().getBase64Url())
                    .ifPresent(c -> {
                        c.setSignatureCount(result.getSignatureCount());
                        c.setLastUsedAt(LocalDateTime.now());
                        credentialRepo.save(c);
                    });

            String username = result.getUsername();
            User user = userRepository.findByEmail(username)
                    .orElseThrow(() -> new IllegalArgumentException("Utilisateur introuvable"));

            String fingerprint = jwtTokenProvider.generateFingerprint();
            String fingerprintHash = jwtTokenProvider.hashFingerprint(fingerprint);

            String accessToken = jwtTokenProvider.generateAccessToken(
                    user.getId(), user.getEmail(), user.getRole().getName().name(),
                    user.getTokenVersion(), fingerprintHash);
            String refreshToken = jwtTokenProvider.generateRefreshToken(
                    user.getId(), user.getEmail(), user.getRole().getName().name(),
                    user.getTokenVersion(), fingerprintHash);

            user.setLastLoginAt(LocalDateTime.now());
            userRepository.save(user);

            metricsService.recordLoginSuccess();
            log.info("WebAuthn login for user {}", user.getEmail());

            return new LoginResponse(accessToken, refreshToken, fingerprint, UserResponse.from(user));

        } catch (AssertionFailedException | IOException e) {
            metricsService.recordLoginFailed();
            throw new IllegalArgumentException("WebAuthn assertion failed: " + e.getMessage(), e);
        }
    }

    private ByteArray generateUserHandle(User user) {
        var existing = credentialRepo.findByUserId(user.getId());
        if (!existing.isEmpty()) {
            try {
                return ByteArray.fromBase64Url(existing.getFirst().getUserHandle());
            } catch (com.yubico.webauthn.data.exception.Base64UrlException e) {
                throw new IllegalStateException("Handle WebAuthn corrompu en base", e);
            }
        }
        byte[] handle = new byte[32];
        RANDOM.nextBytes(handle);
        return new ByteArray(handle);
    }

    private record PendingRegistration(PublicKeyCredentialCreationOptions options, UUID userId, ByteArray userHandle) {}
    private record PendingAssertion(AssertionRequest request) {}
}
