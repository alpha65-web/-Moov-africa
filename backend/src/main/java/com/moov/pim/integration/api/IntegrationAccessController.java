package com.moov.pim.integration.api;

import com.moov.pim.integration.api.dto.IntegrationApiKeyResponse;
import com.moov.pim.integration.api.dto.IntegrationEndpointResponse;
import com.moov.pim.integration.domain.TargetSystem;
import com.moov.pim.integration.service.IntegrationApiKeyService;
import com.moov.pim.integration.service.IntegrationEndpointService;
import com.moov.pim.permissions.security.CustomUserDetails;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

/**
 * Administration du raccordement des systemes tiers.
 *
 * Deux objets distincts, tous deux reserves a EXPORT_MANAGE, qui commande deja le
 * declenchement des exports : les endpoints, ou la plateforme pousse les fiches ;
 * les cles, avec quoi les systemes tiers viennent les lire. Ils sont regroupes ici
 * parce qu'ils repondent a la meme question d'exploitation — ce systeme est-il
 * raccorde, et par quel canal — et qu'un ecran n'exposant que l'un des deux
 * laisserait croire que l'autre n'existe pas.
 */
@RestController
@RequestMapping("/exports")
public class IntegrationAccessController {

    private final IntegrationApiKeyService keyService;
    private final IntegrationEndpointService endpointService;

    public IntegrationAccessController(IntegrationApiKeyService keyService,
                                       IntegrationEndpointService endpointService) {
        this.keyService = keyService;
        this.endpointService = endpointService;
    }

    public record CreateKeyRequest(
            @NotBlank @Size(max = 120) String label,
            @NotNull TargetSystem targetSystem) {}

    /**
     * @param secret valeur en clair de la cle. Elle n'est renvoyee qu'ici, une seule
     *               fois : la base n'en conserve que l'empreinte, et il n'existe
     *               aucun moyen de la relire ensuite.
     */
    public record IssuedKeyResponse(
            UUID id,
            String label,
            String targetSystem,
            String secret,
            LocalDateTime createdAt) {}

    public record UpdateEndpointRequest(
            @Size(max = 500) String url,
            @Size(max = 255) String authHeader,
            boolean active) {}

    @GetMapping("/keys")
    @PreAuthorize("hasAuthority('EXPORT_MANAGE')")
    public ResponseEntity<List<IntegrationApiKeyResponse>> listKeys() {
        return ResponseEntity.ok(keyService.list());
    }

    @PostMapping("/keys")
    @PreAuthorize("hasAuthority('EXPORT_MANAGE')")
    public ResponseEntity<IssuedKeyResponse> createKey(
            @Valid @RequestBody CreateKeyRequest request,
            @AuthenticationPrincipal CustomUserDetails principal) {

        IntegrationApiKeyService.IssuedKey issued = keyService.create(
                request.label(), request.targetSystem(),
                principal == null ? null : principal.getUserId());

        return ResponseEntity.status(HttpStatus.CREATED).body(new IssuedKeyResponse(
                issued.key().id(), issued.key().label(), issued.key().targetSystem(),
                issued.secret(), issued.key().createdAt()));
    }

    @DeleteMapping("/keys/{id}")
    @PreAuthorize("hasAuthority('EXPORT_MANAGE')")
    public ResponseEntity<IntegrationApiKeyResponse> revokeKey(@PathVariable UUID id) {
        return ResponseEntity.ok(keyService.revoke(id));
    }

    @GetMapping("/endpoints")
    @PreAuthorize("hasAuthority('EXPORT_MANAGE')")
    public ResponseEntity<List<IntegrationEndpointResponse>> listEndpoints() {
        return ResponseEntity.ok(endpointService.list());
    }

    @PutMapping("/endpoints/{targetSystem}")
    @PreAuthorize("hasAuthority('EXPORT_MANAGE')")
    public ResponseEntity<IntegrationEndpointResponse> updateEndpoint(
            @PathVariable TargetSystem targetSystem,
            @Valid @RequestBody UpdateEndpointRequest request,
            @AuthenticationPrincipal CustomUserDetails principal) {

        return ResponseEntity.ok(endpointService.update(
                targetSystem, request.url(), request.authHeader(), request.active(),
                principal == null ? null : principal.getUserId()));
    }
}
