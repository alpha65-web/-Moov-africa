package com.moov.pim.permissions.security;

import com.moov.pim.permissions.domain.WebAuthnCredential;
import com.moov.pim.permissions.repository.UserRepository;
import com.moov.pim.permissions.repository.WebAuthnCredentialRepository;
import com.yubico.webauthn.CredentialRepository;
import com.yubico.webauthn.RegisteredCredential;
import com.yubico.webauthn.data.ByteArray;
import com.yubico.webauthn.data.PublicKeyCredentialDescriptor;
import com.yubico.webauthn.data.PublicKeyCredentialType;
import com.yubico.webauthn.data.exception.Base64UrlException;
import org.springframework.stereotype.Component;

import java.util.HashSet;
import java.util.Optional;
import java.util.Set;
import java.util.stream.Collectors;

@Component
public class WebAuthnCredentialStore implements CredentialRepository {

    private final WebAuthnCredentialRepository credentialRepo;
    private final UserRepository userRepository;

    public WebAuthnCredentialStore(WebAuthnCredentialRepository credentialRepo,
                                  UserRepository userRepository) {
        this.credentialRepo = credentialRepo;
        this.userRepository = userRepository;
    }

    @Override
    public Set<PublicKeyCredentialDescriptor> getCredentialIdsForUsername(String username) {
        return userRepository.findByEmail(username)
                .map(user -> credentialRepo.findByUserId(user.getId()).stream()
                        .map(c -> PublicKeyCredentialDescriptor.builder()
                                .id(parseBase64Url(c.getCredentialId()))
                                .type(PublicKeyCredentialType.PUBLIC_KEY)
                                .build())
                        .collect(Collectors.toSet()))
                .orElse(new HashSet<>());
    }

    @Override
    public Optional<ByteArray> getUserHandleForUsername(String username) {
        return userRepository.findByEmail(username)
                .flatMap(user -> credentialRepo.findByUserId(user.getId()).stream().findFirst())
                .map(c -> parseBase64Url(c.getUserHandle()));
    }

    @Override
    public Optional<String> getUsernameForUserHandle(ByteArray userHandle) {
        String handle = userHandle.getBase64Url();
        return credentialRepo.findByUserHandle(handle).stream()
                .findFirst()
                .flatMap(c -> userRepository.findById(c.getUserId()))
                .map(u -> u.getEmail());
    }

    @Override
    public Optional<RegisteredCredential> lookup(ByteArray credentialId, ByteArray userHandle) {
        return credentialRepo.findByCredentialId(credentialId.getBase64Url())
                .filter(c -> c.getUserHandle().equals(userHandle.getBase64Url()))
                .map(this::toRegisteredCredential);
    }

    @Override
    public Set<RegisteredCredential> lookupAll(ByteArray credentialId) {
        return credentialRepo.findByCredentialId(credentialId.getBase64Url())
                .map(this::toRegisteredCredential)
                .map(Set::of)
                .orElse(Set.of());
    }

    private RegisteredCredential toRegisteredCredential(WebAuthnCredential c) {
        return RegisteredCredential.builder()
                .credentialId(parseBase64Url(c.getCredentialId()))
                .userHandle(parseBase64Url(c.getUserHandle()))
                .publicKeyCose(parseBase64Url(c.getPublicKeyCose()))
                .signatureCount(c.getSignatureCount())
                .build();
    }

    private static ByteArray parseBase64Url(String value) {
        try {
            return ByteArray.fromBase64Url(value);
        } catch (Base64UrlException e) {
            throw new IllegalStateException("Donnée WebAuthn corrompue en base", e);
        }
    }
}
