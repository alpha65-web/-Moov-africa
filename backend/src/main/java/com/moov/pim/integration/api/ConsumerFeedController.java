package com.moov.pim.integration.api;

import com.moov.pim.integration.api.dto.FeedEntry;
import com.moov.pim.integration.domain.TargetSystem;
import com.moov.pim.integration.service.ConsumerFeedService;
import com.moov.pim.shared.security.ApiKeyAuthenticator;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * Flux consomme par les systemes tiers — CRM, centre d'appel, site web.
 *
 * Seule route de la plateforme ouverte a un appelant qui n'est pas une personne.
 * L'authentification passe par une cle dediee presentee dans l'en-tete X-Api-Key,
 * et cette cle porte le canal : un appelant ne lit que son propre flux, il n'a pas
 * a preciser lequel et ne peut pas en demander un autre.
 */
@RestController
@RequestMapping("/feed")
public class ConsumerFeedController {

    private final ConsumerFeedService feedService;

    public ConsumerFeedController(ConsumerFeedService feedService) {
        this.feedService = feedService;
    }

    /**
     * Fiches destinees a l'appelant.
     *
     * @param since horodatage de la derniere synchronisation. Fourni, il ne renvoie
     *              que ce qui a bouge depuis : c'est ce qui rend une consultation
     *              frequente tenable sans retelecharger tout le catalogue.
     */
    @GetMapping("/offers")
    @PreAuthorize("hasAuthority('FEED_CONSUME')")
    public ResponseEntity<List<FeedEntry>> offers(
            @AuthenticationPrincipal ApiKeyAuthenticator.ApiKeyPrincipal principal,
            @RequestParam(required = false)
            @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) LocalDateTime since) {
        return ResponseEntity.ok(feedService.feedFor(target(principal), since));
    }

    @GetMapping("/offers/{offerId}")
    @PreAuthorize("hasAuthority('FEED_CONSUME')")
    public ResponseEntity<FeedEntry> offer(
            @AuthenticationPrincipal ApiKeyAuthenticator.ApiKeyPrincipal principal,
            @PathVariable UUID offerId) {
        return ResponseEntity.ok(feedService.entryFor(target(principal), offerId));
    }

    /**
     * Verification de raccordement.
     *
     * Sert a l'equipe qui integre la plateforme cote CRM : elle confirme d'un seul
     * appel que la cle est acceptee et quel canal elle ouvre, sans avoir a
     * interpreter une liste vide comme un probleme d'authentification.
     */
    @GetMapping("/health")
    @PreAuthorize("hasAuthority('FEED_CONSUME')")
    public ResponseEntity<Map<String, String>> health(
            @AuthenticationPrincipal ApiKeyAuthenticator.ApiKeyPrincipal principal) {
        return ResponseEntity.ok(Map.of(
                "status", "ok",
                "consumer", principal.label(),
                "targetSystem", principal.targetSystem()));
    }

    private TargetSystem target(ApiKeyAuthenticator.ApiKeyPrincipal principal) {
        return TargetSystem.valueOf(principal.targetSystem());
    }
}
