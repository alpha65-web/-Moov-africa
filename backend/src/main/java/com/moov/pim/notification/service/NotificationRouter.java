package com.moov.pim.notification.service;

import com.moov.pim.notification.domain.NotificationType;
import com.moov.pim.permissions.domain.RoleName;
import com.moov.pim.permissions.domain.User;
import com.moov.pim.permissions.repository.UserRepository;
import org.springframework.stereotype.Component;

import java.util.List;
import java.util.Set;
import java.util.UUID;

@Component
public class NotificationRouter {

    private final UserRepository userRepository;

    public NotificationRouter(UserRepository userRepository) {
        this.userRepository = userRepository;
    }

    public List<UUID> resolveRecipients(NotificationType type, UUID triggerUserId) {
        Set<RoleName> targetRoles = switch (type) {
            case ENRICHMENT_REQUIRED -> Set.of(RoleName.CHEF_PRODUIT);
            case VALIDATION_REQUIRED -> Set.of(RoleName.CHEF_SERVICE, RoleName.CHEF_DEPARTEMENT);
            case STRATEGIC_VALIDATION -> Set.of(RoleName.CHEF_DEPARTEMENT, RoleName.SUPER_ADMIN);
            case OFFER_REJECTED, OFFER_PUBLISHED -> Set.of(RoleName.CHEF_PRODUIT, RoleName.ANALYSTE_MARKETING);
            case OFFER_EXPIRING -> Set.of(RoleName.CHEF_PRODUIT, RoleName.CHEF_SERVICE);
            case CAMPAIGN_READY, CAMPAIGN_PUBLISHED -> Set.of(RoleName.COMMUNITY_MANAGER, RoleName.ANALYSTE_MARKETING);
            case CAMPAIGN_CANCELLED -> Set.of(RoleName.COMMUNITY_MANAGER, RoleName.CHEF_SERVICE);
            case OFFER_CREATED -> Set.of(RoleName.CHEF_SERVICE, RoleName.CHEF_PRODUIT);
            case MEDIA_VALIDATED, MEDIA_REJECTED -> Set.of(RoleName.CHEF_PRODUIT);
            case AI_TASK_COMPLETED, AI_TASK_FAILED -> Set.of();
            case CATALOG_ITEM_CREATED, CATALOG_ITEM_ARCHIVED -> Set.of(RoleName.CHEF_PRODUIT, RoleName.ADMIN_SYSTEME);
            case USER_REGISTERED -> Set.of(RoleName.ADMIN_SYSTEME, RoleName.SUPER_ADMIN);
        };

        if (targetRoles.isEmpty()) {
            return triggerUserId != null ? List.of(triggerUserId) : List.of();
        }

        return targetRoles.stream()
                .flatMap(role -> userRepository.findByRole_Name(role).stream())
                .map(User::getId)
                .filter(id -> !id.equals(triggerUserId))
                .distinct()
                .toList();
    }
}
