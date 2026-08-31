package com.moov.pim.integration.service;

import com.moov.pim.integration.api.dto.IntegrationApiKeyResponse;
import com.moov.pim.integration.domain.IntegrationApiKey;
import com.moov.pim.integration.domain.TargetSystem;
import com.moov.pim.integration.repository.IntegrationApiKeyRepository;
import com.moov.pim.shared.security.ApiKeyAuthenticator;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.security.SecureRandom;
import java.time.LocalDateTime;
import java.util.Base64;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

/**
 * Cycle de vie des cles remises aux systemes destinataires.
 *
 * La cle en clair n'existe qu'une fois, au moment de sa creation : elle est
 * renvoyee dans la reponse et n'est jamais stockee. La base ne conserve que son
 * empreinte, si bien qu'une fuite du contenu de la table ne donne acces a rien.
 * L'administrateur qui perd une cle en genere une nouvelle et revoque l'ancienne ;
 * il n'existe volontairement aucun moyen de la relire.
 */
@Service
public class IntegrationApiKeyService implements ApiKeyAuthenticator {

    private static final Logger log = LoggerFactory.getLogger(IntegrationApiKeyService.class);

    /** Prefixe lisible, pour reconnaitre une cle Moov PIM dans une configuration tierce. */
    private static final String KEY_PREFIX = "mvpim_";
    private static final int SECRET_BYTES = 32;

    private final IntegrationApiKeyRepository keyRepository;
    private final SecureRandom random = new SecureRandom();

    public IntegrationApiKeyService(IntegrationApiKeyRepository keyRepository) {
        this.keyRepository = keyRepository;
    }

    /** Cle en clair, restituee une seule fois. */
    public record IssuedKey(IntegrationApiKeyResponse key, String secret) {}

    @Transactional
    public IssuedKey create(String label, TargetSystem targetSystem, UUID createdById) {
        byte[] secretBytes = new byte[SECRET_BYTES];
        random.nextBytes(secretBytes);
        String secret = KEY_PREFIX + Base64.getUrlEncoder().withoutPadding().encodeToString(secretBytes);

        IntegrationApiKey key = new IntegrationApiKey();
        key.setLabel(label);
        key.setTargetSystem(targetSystem);
        key.setKeyHash(hash(secret));
        key.setKeyPrefix(secret.substring(0, Math.min(14, secret.length())));
        key.setCreatedById(createdById);

        key = keyRepository.save(key);
        log.info("Cle de consommation '{}' creee pour {}", label, targetSystem);
        return new IssuedKey(IntegrationApiKeyResponse.from(key), secret);
    }

    @Transactional(readOnly = true)
    public List<IntegrationApiKeyResponse> list() {
        return keyRepository.findAllByOrderByCreatedAtDesc().stream()
                .map(IntegrationApiKeyResponse::from)
                .toList();
    }

    @Transactional
    public IntegrationApiKeyResponse revoke(UUID id) {
        IntegrationApiKey key = keyRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Cle introuvable"));
        key.setActive(false);
        key.setRevokedAt(LocalDateTime.now());
        log.info("Cle de consommation '{}' revoquee", key.getLabel());
        return IntegrationApiKeyResponse.from(keyRepository.save(key));
    }

    /**
     * Verification d'une cle presentee par un systeme tiers.
     *
     * Ecrit dans une transaction propre : l'usage de la cle doit etre trace meme
     * si la lecture qui suit echoue, sinon le compteur d'appels ne refleterait que
     * les requetes abouties et l'administrateur ne verrait pas les tentatives d'un
     * systeme mal configure.
     */
    @Override
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public Optional<ApiKeyPrincipal> authenticate(String presentedKey) {
        return keyRepository.findByKeyHashAndActiveTrue(hash(presentedKey))
                .map(key -> {
                    key.setLastUsedAt(LocalDateTime.now());
                    key.setCallCount(key.getCallCount() + 1);
                    keyRepository.save(key);
                    return new ApiKeyPrincipal(key.getId(), key.getLabel(), key.getTargetSystem().name());
                });
    }

    private static String hash(String value) {
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            byte[] hashed = digest.digest(value.getBytes(StandardCharsets.UTF_8));
            StringBuilder hex = new StringBuilder(hashed.length * 2);
            for (byte b : hashed) {
                hex.append(String.format("%02x", b));
            }
            return hex.toString();
        } catch (NoSuchAlgorithmException e) {
            throw new IllegalStateException("SHA-256 indisponible", e);
        }
    }
}
