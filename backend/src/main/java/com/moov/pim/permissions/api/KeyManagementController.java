package com.moov.pim.permissions.api;

import com.moov.pim.permissions.service.KeyManagementService;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.time.LocalDateTime;
import java.util.Map;

@RestController
@RequestMapping("/admin/keys")
@PreAuthorize("hasRole('ADMIN_SYSTEME')")
public class KeyManagementController {

    private final KeyManagementService keyManagementService;

    public KeyManagementController(KeyManagementService keyManagementService) {
        this.keyManagementService = keyManagementService;
    }

    @PostMapping("/emergency-revoke")
    public ResponseEntity<Map<String, Object>> emergencyRevokeAll() {
        int affectedUsers = keyManagementService.emergencyRevokeAllSessions();
        return ResponseEntity.ok(Map.of(
                "status", "ALL_SESSIONS_REVOKED",
                "affectedUsers", affectedUsers,
                "timestamp", LocalDateTime.now().toString()
        ));
    }

    @PostMapping("/rotate-session")
    public ResponseEntity<Map<String, String>> rotateSessionKeys() {
        keyManagementService.rotateSessionKeys();
        return ResponseEntity.ok(Map.of(
                "status", "SESSION_KEYS_ROTATED",
                "timestamp", LocalDateTime.now().toString()
        ));
    }

    @PostMapping("/rotate-master-ack")
    public ResponseEntity<Map<String, String>> acknowledgeMasterKeyRotation() {
        keyManagementService.recordMasterKeyRotation();
        return ResponseEntity.ok(Map.of(
                "status", "MASTER_KEY_ROTATION_RECORDED",
                "note", "Rotate the actual key via Vault CLI: vault kv put secret/pim pim.encryption.key=<new-key>",
                "timestamp", LocalDateTime.now().toString()
        ));
    }

    @GetMapping("/status")
    public ResponseEntity<Map<String, Object>> keyStatus() {
        return ResponseEntity.ok(Map.of(
                "lastSessionKeyRotation", keyManagementService.getLastSessionKeyRotation().toString(),
                "lastMasterKeyRotation", keyManagementService.getLastMasterKeyRotation().toString()
        ));
    }
}
