package com.moov.pim.permissions.repository;

import com.moov.pim.permissions.domain.WebAuthnCredential;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface WebAuthnCredentialRepository extends JpaRepository<WebAuthnCredential, UUID> {

    List<WebAuthnCredential> findByUserId(UUID userId);

    Optional<WebAuthnCredential> findByCredentialId(String credentialId);

    List<WebAuthnCredential> findByUserHandle(String userHandle);

    void deleteByUserIdAndId(UUID userId, UUID id);
}
