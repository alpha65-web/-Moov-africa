package com.moov.pim.lifecycle.api;

import com.moov.pim.lifecycle.api.dto.CreateOfferRequest;
import com.moov.pim.lifecycle.api.dto.EnrichOfferRequest;
import com.moov.pim.lifecycle.api.dto.OfferResponse;
import com.moov.pim.lifecycle.api.dto.StatusTransitionRequest;
import com.moov.pim.lifecycle.domain.OfferStatus;
import com.moov.pim.lifecycle.service.OfferService;
import com.moov.pim.permissions.security.CustomUserDetails;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
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

    @GetMapping("/mine")
    @PreAuthorize("hasAuthority('OFFER_CREATE')")
    public ResponseEntity<List<OfferResponse>> myOffers(@AuthenticationPrincipal CustomUserDetails principal) {
        return ResponseEntity.ok(offerService.listByUser(principal.getUserId()));
    }

    @GetMapping
    @PreAuthorize("hasAuthority('CATALOG_READ')")
    public ResponseEntity<List<OfferResponse>> list(@RequestParam(required = false) OfferStatus status) {
        if (status != null) {
            return ResponseEntity.ok(offerService.listByStatus(status));
        }
        return ResponseEntity.ok(offerService.listAll());
    }
}
