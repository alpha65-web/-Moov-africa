package com.moov.pim.integration.repository;

import com.moov.pim.integration.domain.IntegrationApiKey;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface IntegrationApiKeyRepository extends JpaRepository<IntegrationApiKey, UUID> {

    Optional<IntegrationApiKey> findByKeyHashAndActiveTrue(String keyHash);

    List<IntegrationApiKey> findAllByOrderByCreatedAtDesc();
}
