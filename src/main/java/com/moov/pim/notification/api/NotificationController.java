package com.moov.pim.notification.api;

import com.moov.pim.notification.domain.Notification;
import com.moov.pim.notification.service.NotificationService;
import com.moov.pim.permissions.security.CustomUserDetails;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
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
    public ResponseEntity<List<Notification>> list(@AuthenticationPrincipal CustomUserDetails principal) {
        return ResponseEntity.ok(notificationService.listForUser(principal.getUserId()));
    }

    @GetMapping("/unread")
    public ResponseEntity<List<Notification>> unread(@AuthenticationPrincipal CustomUserDetails principal) {
        return ResponseEntity.ok(notificationService.listUnreadForUser(principal.getUserId()));
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
}
