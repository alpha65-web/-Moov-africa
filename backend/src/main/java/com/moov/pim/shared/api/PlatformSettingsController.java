package com.moov.pim.shared.api;

import com.moov.pim.permissions.security.CustomUserDetails;
import com.moov.pim.shared.domain.PlatformSettings;
import com.moov.pim.shared.repository.PlatformSettingsRepository;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.time.LocalDateTime;
import java.time.ZoneId;
import java.util.UUID;

/**
 * Reglages generaux de la plateforme et rappel de la politique de securite en vigueur.
 *
 * La lecture est ouverte a tout compte authentifie : ces valeurs pilotent l'affichage
 * (devise, fuseau). Seule l'ecriture exige la permission de configuration.
 */
@RestController
@RequestMapping("/config/platform")
public class PlatformSettingsController {

    /** Longueur minimale imposee par PasswordPolicyService. */
    private static final int PASSWORD_MIN_LENGTH = 12;

    private final PlatformSettingsRepository repository;
    private final boolean mfaMandatoryForAdmins;

    public PlatformSettingsController(
            PlatformSettingsRepository repository,
            @Value("${pim.mfa.require-for-admin:true}") boolean mfaMandatoryForAdmins) {
        this.repository = repository;
        this.mfaMandatoryForAdmins = mfaMandatoryForAdmins;
    }

    public record PlatformSettingsResponse(
            String platformName,
            String defaultLanguage,
            String currency,
            String timezone,
            UUID updatedById,
            LocalDateTime updatedAt,
            SecurityPolicy securityPolicy
    ) {}

    /**
     * Politique appliquee par le serveur, restituee telle quelle pour que l'interface
     * affiche les regles reellement en vigueur au lieu de valeurs decoratives.
     */
    public record SecurityPolicy(
            int passwordMinLength,
            boolean requireUppercase,
            boolean requireLowercase,
            boolean requireDigit,
            boolean requireSpecialCharacter,
            boolean checkBreachedPasswords,
            boolean mfaMandatoryForAdmins
    ) {}

    public record UpdatePlatformSettingsRequest(
            @NotBlank @Size(max = 120) String platformName,
            @NotBlank @Size(max = 10) String defaultLanguage,
            @NotBlank @Size(max = 10) String currency,
            @NotBlank @Size(max = 60) String timezone
    ) {}

    @GetMapping
    public ResponseEntity<PlatformSettingsResponse> get() {
        return ResponseEntity.ok(toResponse(load()));
    }

    @PutMapping
    @PreAuthorize("hasAuthority('CONFIG_MANAGE')")
    @Transactional
    public ResponseEntity<PlatformSettingsResponse> update(
            @Valid @RequestBody UpdatePlatformSettingsRequest request,
            @AuthenticationPrincipal CustomUserDetails principal) {

        // Un fuseau inconnu rendrait toutes les dates de l'interface incoherentes.
        if (!ZoneId.getAvailableZoneIds().contains(request.timezone())) {
            throw new IllegalArgumentException("Fuseau horaire inconnu : " + request.timezone());
        }

        PlatformSettings settings = load();
        settings.setPlatformName(request.platformName());
        settings.setDefaultLanguage(request.defaultLanguage());
        settings.setCurrency(request.currency());
        settings.setTimezone(request.timezone());
        settings.setUpdatedById(principal == null ? null : principal.getUserId());
        return ResponseEntity.ok(toResponse(repository.save(settings)));
    }

    private PlatformSettings load() {
        return repository.findById(PlatformSettings.SINGLETON_ID)
                .orElseThrow(() -> new IllegalStateException(
                        "Les reglages de la plateforme sont absents : la migration V029 n'a pas ete jouee"));
    }

    private PlatformSettingsResponse toResponse(PlatformSettings s) {
        return new PlatformSettingsResponse(
                s.getPlatformName(), s.getDefaultLanguage(), s.getCurrency(), s.getTimezone(),
                s.getUpdatedById(), s.getUpdatedAt(),
                new SecurityPolicy(PASSWORD_MIN_LENGTH, true, true, true, true, true, mfaMandatoryForAdmins));
    }
}
