package com.moov.pim.shared.security;

import com.moov.pim.permissions.security.CustomUserDetails;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;

import java.util.UUID;

@Service("ownership")
public class ResourceOwnershipService {

    public boolean isOwnerOrAdmin(UUID resourceOwnerId) {
        var auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth == null || !(auth.getPrincipal() instanceof CustomUserDetails principal)) {
            return false;
        }

        if (principal.getAuthorities().stream()
                .anyMatch(a -> a.getAuthority().equals("USER_MANAGE"))) {
            return true;
        }

        return principal.getUserId().equals(resourceOwnerId);
    }

    public UUID currentUserId() {
        var auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth == null || !(auth.getPrincipal() instanceof CustomUserDetails principal)) {
            throw new SecurityException("Unauthenticated");
        }
        return principal.getUserId();
    }
}
