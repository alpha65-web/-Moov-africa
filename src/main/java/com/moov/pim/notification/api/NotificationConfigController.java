package com.moov.pim.notification.api;

import com.moov.pim.notification.api.dto.NotificationConfigResponse;
import com.moov.pim.notification.api.dto.UpdateNotificationConfigRequest;
import com.moov.pim.notification.service.NotificationConfigService;
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
@RequestMapping("/config/notifications")
public class NotificationConfigController {

    private final NotificationConfigService configService;

    public NotificationConfigController(NotificationConfigService configService) {
        this.configService = configService;
    }

    @GetMapping
    @PreAuthorize("hasAuthority('CONFIG_MANAGE')")
    public ResponseEntity<List<NotificationConfigResponse>> listAll() {
        return ResponseEntity.ok(configService.listAll());
    }

    @PutMapping("/{id}")
    @PreAuthorize("hasAuthority('CONFIG_MANAGE')")
    public ResponseEntity<NotificationConfigResponse> update(@PathVariable UUID id,
                                                              @Valid @RequestBody UpdateNotificationConfigRequest request) {
        return ResponseEntity.ok(configService.update(id, request));
    }
}
