package com.moov.pim.lifecycle.api;

import com.moov.pim.lifecycle.api.dto.AnalystWorkloadResponse;
import com.moov.pim.lifecycle.api.dto.AssignOfferRequest;
import com.moov.pim.lifecycle.api.dto.CreateOfferRequest;
import com.moov.pim.lifecycle.api.dto.EnrichOfferRequest;
import com.moov.pim.lifecycle.api.dto.OfferHistoryEntryResponse;
import com.moov.pim.lifecycle.api.dto.OfferResponse;
import com.moov.pim.lifecycle.api.dto.OfferVersionResponse;
import com.moov.pim.lifecycle.api.dto.StatusTransitionRequest;
import com.moov.pim.lifecycle.api.dto.UpdateOfferRequest;
import com.moov.pim.lifecycle.domain.OfferStatus;
import com.moov.pim.lifecycle.service.OfferService;
import com.moov.pim.permissions.security.CustomUserDetails;
import jakarta.validation.Valid;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/offers")
public class OfferController {

    private final OfferService offerService;

    public OfferController(OfferService offerService) {
        this.offerService = offerService;
    }

    @PostMapping
    @PreAuthorize("hasAuthority('OFFER_CREATE')")
    public ResponseEntity<OfferResponse> create(@Valid @RequestBody CreateOfferRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED).body(offerService.create(request));
    }

    /**
     * Modification des champs commerciaux, reservee a leur proprietaire metier.
     *
     * Volontairement distinct de /enrich : les deux endpoints portent sur la meme
     * fiche mais sur des champs disjoints, et exigent des permissions differentes.
     * C'est ce qui permet au chef de produit de corriger son offre apres un rejet
     * sans toucher au travail de l'analyste marketing, et inversement.
     */
    @PatchMapping("/{id}")
    @PreAuthorize("hasAuthority('OFFER_CREATE')")
    public ResponseEntity<OfferResponse> update(@PathVariable UUID id,
                                                @Valid @RequestBody UpdateOfferRequest request) {
        return ResponseEntity.ok(offerService.update(id, request));
    }

    /**
     * Repartition du travail d'enrichissement entre les analystes marketing.
     *
     * Reserve au chef de service : c'est lui qui encadre les analystes et qui
     * valide ensuite leur travail. Le corps sans identifiant libere l'offre.
     */
    @PatchMapping("/{id}/assign")
    @PreAuthorize("hasAuthority('OFFER_ASSIGN')")
    public ResponseEntity<OfferResponse> assign(@PathVariable UUID id,
                                                @RequestBody AssignOfferRequest request) {
        return ResponseEntity.ok(offerService.assign(id, request));
    }

    /**
     * Analystes marketing disponibles, tries du moins charge au plus charge.
     *
     * Situe ici et non dans le module des comptes : la donnee qui interesse le chef
     * de service n'est pas l'annuaire mais la charge, et la charge se compte sur les
     * offres. L'endpoint precedent, /users/enrichers, ne renvoyait que des noms — le
     * chef de service devait donc repartir le travail sans savoir qui etait pris.
     */
    @GetMapping("/enrichers")
    @PreAuthorize("hasAuthority('OFFER_ASSIGN')")
    public ResponseEntity<List<AnalystWorkloadResponse>> enrichers() {
        return ResponseEntity.ok(offerService.listEnrichersWithWorkload());
    }

    @PatchMapping("/{id}/enrich")
    @PreAuthorize("hasAuthority('OFFER_ENRICH')")
    public ResponseEntity<OfferResponse> enrich(@PathVariable UUID id, @RequestBody EnrichOfferRequest request) {
        return ResponseEntity.ok(offerService.enrich(id, request));
    }

    @PostMapping("/{id}/transition")
    @PreAuthorize("hasAnyAuthority('OFFER_SUBMIT', 'OFFER_VALIDATE', 'OFFER_PUBLISH')")
    public ResponseEntity<OfferResponse> transition(@PathVariable UUID id,
                                                    @Valid @RequestBody StatusTransitionRequest request) {
        return ResponseEntity.ok(offerService.transition(id, request));
    }

    @GetMapping("/{id}")
    @PreAuthorize("hasAuthority('CATALOG_READ')")
    public ResponseEntity<OfferResponse> getById(@PathVariable UUID id) {
        return ResponseEntity.ok(offerService.getById(id));
    }

    /**
     * Parcours de l'offre : chaque transition, son auteur, sa date et son motif.
     *
     * Ouvert a qui peut deja voir la fiche : un chef de service doit pouvoir lire
     * le commentaire de rejet qui la lui renvoie, et un chef de produit savoir
     * pourquoi la sienne est revenue. Le perimetre de visibilite de l'offre est
     * verifie dans le service.
     */
    @GetMapping("/{id}/history")
    @PreAuthorize("hasAuthority('CATALOG_READ')")
    public ResponseEntity<List<OfferHistoryEntryResponse>> history(@PathVariable UUID id) {
        return ResponseEntity.ok(offerService.history(id));
    }

    /** Etats anterieurs complets de la fiche, du plus recent au plus ancien. */
    @GetMapping("/{id}/versions")
    @PreAuthorize("hasAuthority('CATALOG_READ')")
    public ResponseEntity<List<OfferVersionResponse>> versions(@PathVariable UUID id) {
        return ResponseEntity.ok(offerService.versions(id));
    }

    /**
     * Restaure le contenu d'une version anterieure.
     *
     * Reserve a AUDIT_VIEW : le cahier des charges (7.7) confie l'historique
     * complet « avec rollback » au seul administrateur, les autres acteurs n'y
     * ayant qu'un acces en lecture sur leurs propres fiches.
     */
    @PostMapping("/{id}/versions/{versionNumber}/restore")
    @PreAuthorize("hasAuthority('AUDIT_VIEW')")
    public ResponseEntity<OfferResponse> restoreVersion(@PathVariable UUID id,
                                                        @PathVariable long versionNumber) {
        return ResponseEntity.ok(offerService.restoreVersion(id, versionNumber));
    }

    @GetMapping("/mine")
    @PreAuthorize("hasAuthority('OFFER_CREATE')")
    public ResponseEntity<Page<OfferResponse>> myOffers(@AuthenticationPrincipal CustomUserDetails principal,
                                                        Pageable pageable) {
        return ResponseEntity.ok(offerService.listByUser(principal.getUserId(), pageable));
    }

    @GetMapping
    @PreAuthorize("hasAuthority('CATALOG_READ')")
    public ResponseEntity<Page<OfferResponse>> list(
            @RequestParam(required = false) OfferStatus status,
            @RequestParam(required = false) String search,
            Pageable pageable) {
        return ResponseEntity.ok(offerService.search(status, search, pageable));
    }

    @DeleteMapping("/{id}")
    @PreAuthorize("hasAuthority('OFFER_CREATE')")
    public ResponseEntity<Void> delete(@PathVariable UUID id) {
        offerService.delete(id);
        return ResponseEntity.noContent().build();
    }
}
