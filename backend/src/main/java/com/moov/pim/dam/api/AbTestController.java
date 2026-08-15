package com.moov.pim.dam.api;

import com.moov.pim.dam.api.dto.AbTestResponse;
import com.moov.pim.dam.api.dto.CreateAbTestRequest;
import com.moov.pim.dam.service.AbTestService;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/ab-tests")
public class AbTestController {

    private final AbTestService abTestService;

    public AbTestController(AbTestService abTestService) {
        this.abTestService = abTestService;
    }

    @PostMapping
    @PreAuthorize("hasAuthority('CATALOG_WRITE')")
    public ResponseEntity<AbTestResponse> create(@Valid @RequestBody CreateAbTestRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED).body(abTestService.create(request));
    }

    @GetMapping("/offers/{offerId}")
    @PreAuthorize("hasAuthority('CATALOG_READ')")
    public ResponseEntity<List<AbTestResponse>> listByOffer(@PathVariable UUID offerId) {
        return ResponseEntity.ok(abTestService.listByOffer(offerId));
    }

    @GetMapping("/{id}")
    @PreAuthorize("hasAuthority('CATALOG_READ')")
    public ResponseEntity<AbTestResponse> getById(@PathVariable UUID id) {
        return ResponseEntity.ok(abTestService.getById(id));
    }

    @PostMapping("/{id}/start")
    @PreAuthorize("hasAuthority('CATALOG_WRITE')")
    public ResponseEntity<AbTestResponse> start(@PathVariable UUID id) {
        return ResponseEntity.ok(abTestService.start(id));
    }

    @PostMapping("/{id}/complete")
    @PreAuthorize("hasAuthority('CATALOG_WRITE')")
    public ResponseEntity<AbTestResponse> complete(@PathVariable UUID id,
                                                    @RequestBody Map<String, String> body) {
        return ResponseEntity.ok(abTestService.complete(id, body.get("winner")));
    }

    @PostMapping("/{id}/cancel")
    @PreAuthorize("hasAuthority('CATALOG_WRITE')")
    public ResponseEntity<AbTestResponse> cancel(@PathVariable UUID id) {
        return ResponseEntity.ok(abTestService.cancel(id));
    }
}
