package com.moov.pim.integration.service;

import com.moov.pim.integration.api.dto.IntegrationEndpointResponse;
import com.moov.pim.integration.domain.IntegrationEndpoint;
import com.moov.pim.integration.domain.TargetSystem;
import com.moov.pim.integration.repository.IntegrationEndpointRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.net.URI;
import java.util.List;
import java.util.UUID;

/**
 * Raccordement des systemes destinataires.
 *
 * Renseigner une URL fait basculer un systeme de la mise a disposition a la remise
 * active, sans redemarrage. C'est volontaire : le CRM et le centre d'appel de Moov
 * n'ont pas ete ouverts pendant le projet, mais le jour ou ils le seront, le
 * raccordement doit etre une saisie d'exploitation et non une modification de code.
 */
@Service
public class IntegrationEndpointService {

    private static final Logger log = LoggerFactory.getLogger(IntegrationEndpointService.class);

    private final IntegrationEndpointRepository endpointRepository;

    public IntegrationEndpointService(IntegrationEndpointRepository endpointRepository) {
        this.endpointRepository = endpointRepository;
    }

    @Transactional(readOnly = true)
    public List<IntegrationEndpointResponse> list() {
        return endpointRepository.findAllByOrderByTargetSystemAsc().stream()
                .map(IntegrationEndpointResponse::from)
                .toList();
    }

    @Transactional
    public IntegrationEndpointResponse update(TargetSystem targetSystem, String url, String authHeader,
                                              boolean active, UUID updatedById) {
        IntegrationEndpoint endpoint = endpointRepository.findById(targetSystem)
                .orElseGet(() -> {
                    IntegrationEndpoint created = new IntegrationEndpoint();
                    created.setTargetSystem(targetSystem);
                    return created;
                });

        String cleanedUrl = (url == null || url.isBlank()) ? null : url.trim();
        if (cleanedUrl != null) {
            validate(cleanedUrl);
        }
        if (active && cleanedUrl == null) {
            throw new IllegalArgumentException(
                    "Activer la remise vers " + targetSystem + " exige une URL de destination");
        }

        endpoint.setUrl(cleanedUrl);
        endpoint.setAuthHeader(authHeader == null || authHeader.isBlank() ? null : authHeader.trim());
        endpoint.setActive(active);
        endpoint.setUpdatedById(updatedById);

        log.info("Raccordement de {} : {}", targetSystem,
                endpoint.isReachable() ? "remise active vers " + cleanedUrl : "mise a disposition sur le flux");
        return IntegrationEndpointResponse.from(endpointRepository.save(endpoint));
    }

    /**
     * Une URL invalide acceptee ici produirait un echec de diffusion a chaque
     * publication, decouvert bien plus tard et attribue a tort a la plateforme.
     */
    private void validate(String url) {
        URI uri;
        try {
            uri = URI.create(url);
        } catch (IllegalArgumentException e) {
            throw new IllegalArgumentException("URL de destination invalide : " + url);
        }
        String scheme = uri.getScheme();
        if (scheme == null || !(scheme.equals("http") || scheme.equals("https")) || uri.getHost() == null) {
            throw new IllegalArgumentException("URL de destination invalide : " + url);
        }
    }
}
