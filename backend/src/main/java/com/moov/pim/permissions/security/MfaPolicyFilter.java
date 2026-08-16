package com.moov.pim.permissions.security;

import com.moov.pim.permissions.domain.RoleName;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.util.Set;

@Component
public class MfaPolicyFilter extends OncePerRequestFilter {

    private static final Set<String> MFA_EXEMPT_PATHS = Set.of(
            "/auth/totp/setup", "/auth/totp/enable", "/auth/totp",
            "/auth/change-password", "/auth/logout", "/auth/refresh",
            "/users/me",
            "/auth/webauthn/register/options", "/auth/webauthn/register/verify"
    );

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain filterChain)
            throws ServletException, IOException {

        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth != null && auth.getPrincipal() instanceof CustomUserDetails userDetails) {
            String roleName = userDetails.getUser().getRole().getName().name();
            boolean isAdmin = RoleName.ADMIN_SYSTEME.name().equals(roleName);
            boolean hasMfa = userDetails.getUser().isTotpEnabled();

            if (isAdmin && !hasMfa) {
                String path = request.getServletPath();
                if (!isMfaExemptPath(path)) {
                    response.setStatus(HttpStatus.FORBIDDEN.value());
                    response.setContentType(MediaType.APPLICATION_JSON_VALUE);
                    response.getWriter().write(
                            "{\"status\":403,\"message\":\"MFA obligatoire pour les administrateurs. Configurez-le via /auth/totp/setup\",\"code\":\"MFA_REQUIRED_FOR_ADMIN\"}");
                    return;
                }
            }
        }

        filterChain.doFilter(request, response);
    }

    private boolean isMfaExemptPath(String path) {
        return MFA_EXEMPT_PATHS.stream().anyMatch(path::startsWith);
    }
}
