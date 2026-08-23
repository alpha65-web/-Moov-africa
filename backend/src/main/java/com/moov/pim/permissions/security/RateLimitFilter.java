package com.moov.pim.permissions.security;

import jakarta.annotation.PostConstruct;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.time.Instant;
import java.util.Iterator;
import java.util.Map;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.Executors;
import java.util.concurrent.ScheduledExecutorService;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicInteger;

@Component
public class RateLimitFilter extends OncePerRequestFilter {

    private static final int AUTH_MAX_ATTEMPTS = 5;
    private static final int UPLOAD_MAX_ATTEMPTS = 10;
    private static final int GENERAL_MAX_ATTEMPTS = 100;
    private static final long WINDOW_SECONDS = 60;

    @Value("${pim.rate-limit.trusted-proxies:}")
    private String trustedProxies;

    private Set<String> trustedProxySet;

    private final Map<String, RateWindow> windows = new ConcurrentHashMap<>();
    private final ScheduledExecutorService cleaner = Executors.newSingleThreadScheduledExecutor(r -> {
        Thread t = new Thread(r, "rate-limit-cleaner");
        t.setDaemon(true);
        return t;
    });

    @PostConstruct
    void init() {
        trustedProxySet = Set.of(
                (trustedProxies != null && !trustedProxies.isBlank())
                        ? trustedProxies.split(",") : new String[0]
        );
        cleaner.scheduleAtFixedRate(this::evictExpired, 60, 60, TimeUnit.SECONDS);
    }

    private void evictExpired() {
        Iterator<Map.Entry<String, RateWindow>> it = windows.entrySet().iterator();
        while (it.hasNext()) {
            if (it.next().getValue().isExpired()) it.remove();
        }
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain chain)
            throws ServletException, IOException {

        String path = request.getServletPath();
        if (isStaticOrHealth(path)) {
            chain.doFilter(request, response);
            return;
        }

        int maxAttempts = isAuthEndpoint(request) ? AUTH_MAX_ATTEMPTS
                : isUploadEndpoint(request) ? UPLOAD_MAX_ATTEMPTS
                : GENERAL_MAX_ATTEMPTS;

        String key = clientKey(request);
        RateWindow window = windows.compute(key, (k, w) -> {
            if (w == null || w.isExpired()) return new RateWindow();
            return w;
        });

        int current = window.count.incrementAndGet();
        int remaining = Math.max(0, maxAttempts - current);
        long resetSeconds = WINDOW_SECONDS - (Instant.now().getEpochSecond() - window.start.getEpochSecond());

        response.setHeader("X-RateLimit-Limit", String.valueOf(maxAttempts));
        response.setHeader("X-RateLimit-Remaining", String.valueOf(remaining));
        response.setHeader("X-RateLimit-Reset", String.valueOf(Math.max(0, resetSeconds)));

        if (current > maxAttempts) {
            response.setStatus(HttpStatus.TOO_MANY_REQUESTS.value());
            response.setContentType(MediaType.APPLICATION_JSON_VALUE);
            response.setHeader("Retry-After", String.valueOf(Math.max(0, resetSeconds)));
            response.getWriter().write(
                    "{\"status\":429,\"message\":\"Trop de requêtes. Réessayez dans " + resetSeconds + " secondes.\"}");
            return;
        }

        chain.doFilter(request, response);
    }

    private boolean isAuthEndpoint(HttpServletRequest request) {
        String path = request.getServletPath();
        return "POST".equalsIgnoreCase(request.getMethod())
                && (path.equals("/auth/login") || path.equals("/auth/refresh") || path.equals("/auth/register"));
    }

    private boolean isUploadEndpoint(HttpServletRequest request) {
        return "POST".equalsIgnoreCase(request.getMethod())
                && request.getServletPath().equals("/media");
    }

    private boolean isStaticOrHealth(String path) {
        return path.startsWith("/actuator/") || path.startsWith("/swagger-ui") || path.startsWith("/api-docs");
    }

    private String clientKey(HttpServletRequest request) {
        String ip = resolveClientIp(request);
        if (isAuthEndpoint(request)) return ip + ":auth";
        if (isUploadEndpoint(request)) return ip + ":upload";
        return ip + ":general";
    }

    private String resolveClientIp(HttpServletRequest request) {
        String remoteAddr = request.getRemoteAddr();
        if (trustedProxySet.contains(remoteAddr)) {
            String forwarded = request.getHeader("X-Forwarded-For");
            if (forwarded != null && !forwarded.isBlank()) {
                return forwarded.split(",")[0].trim();
            }
        }
        return remoteAddr;
    }

    private static class RateWindow {
        final Instant start = Instant.now();
        final AtomicInteger count = new AtomicInteger(0);

        boolean isExpired() {
            return Instant.now().isAfter(start.plusSeconds(WINDOW_SECONDS));
        }
    }
}
