package com.moov.pim.notification.api;

import com.moov.pim.notification.api.dto.NotificationResponse;
import com.moov.pim.notification.service.NotificationService;
import com.moov.pim.permissions.security.CustomUserDetails;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/notifications")
public class NotificationController {

    private final NotificationService notificationService;

    public NotificationController(NotificationService notificationService) {
        this.notificationService = notificationService;
    }

    @GetMapping
    public ResponseEntity<Page<NotificationResponse>> list(@AuthenticationPrincipal CustomUserDetails principal,
                                                           Pageable pageable) {
        return ResponseEntity.ok(notificationService.listForUser(principal.getUserId(), pageable));
    }

    @GetMapping("/unread")
    public ResponseEntity<Page<NotificationResponse>> unread(@AuthenticationPrincipal CustomUserDetails principal,
                                                             Pageable pageable) {
        return ResponseEntity.ok(notificationService.listUnreadForUser(principal.getUserId(), pageable));
    }

    @GetMapping("/unread/count")
    public ResponseEntity<Map<String, Long>> unreadCount(@AuthenticationPrincipal CustomUserDetails principal) {
        return ResponseEntity.ok(Map.of("count", notificationService.countUnread(principal.getUserId())));
    }

    @PatchMapping("/{id}/read")
    public ResponseEntity<Void> markAsRead(@PathVariable UUID id) {
        notificationService.markAsRead(id);
        return ResponseEntity.noContent().build();
    }

    @PatchMapping("/read-all")
    public ResponseEntity<Void> markAllAsRead(@AuthenticationPrincipal CustomUserDetails principal) {
        notificationService.markAllAsRead(principal.getUserId());
        return ResponseEntity.noContent().build();
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(@PathVariable UUID id) {
        notificationService.delete(id);
        return ResponseEntity.noContent().build();
    }
}
