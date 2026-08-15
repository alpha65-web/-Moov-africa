package com.moov.pim.analytics.api;

import com.moov.pim.analytics.api.dto.KpiConfigResponse;
import com.moov.pim.analytics.api.dto.UpdateKpiConfigRequest;
import com.moov.pim.analytics.service.KpiConfigService;
import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/config/kpi")
public class KpiConfigController {

    private final KpiConfigService configService;

    public KpiConfigController(KpiConfigService configService) {
        this.configService = configService;
    }

    @GetMapping
    @PreAuthorize("hasAuthority('CONFIG_MANAGE')")
    public ResponseEntity<List<KpiConfigResponse>> listAll() {
        return ResponseEntity.ok(configService.listAll());
    }

    @PutMapping("/{id}")
    @PreAuthorize("hasAuthority('CONFIG_MANAGE')")
    public ResponseEntity<KpiConfigResponse> update(@PathVariable UUID id,
                                                     @Valid @RequestBody UpdateKpiConfigRequest request) {
        return ResponseEntity.ok(configService.update(id, request));
    }
}
