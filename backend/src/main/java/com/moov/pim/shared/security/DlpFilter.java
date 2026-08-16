package com.moov.pim.shared.security;

import com.moov.pim.shared.logging.SecurityMetricsService;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;
import org.springframework.web.util.ContentCachingResponseWrapper;

import java.io.IOException;
import java.time.Instant;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.AtomicInteger;

@Component
public class DlpFilter extends OncePerRequestFilter {

    private static final Logger log = LoggerFactory.getLogger(DlpFilter.class);

    @Value("${pim.dlp.max-response-bytes:5242880}")
    private long maxResponseBytes;

    @Value("${pim.dlp.max-requests-per-minute:200}")
    private int maxRequestsPerMinute;

    @Value("${pim.dlp.enabled:true}")
    private boolean enabled;

    private final SecurityMetricsService metricsService;
    private final Map<String, AccessWindow> accessWindows = new ConcurrentHashMap<>();

    public DlpFilter(SecurityMetricsService metricsService) {
        this.metricsService = metricsService;
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain chain)
            throws ServletException, IOException {

        if (!enabled || isExcluded(request.getServletPath())) {
            chain.doFilter(request, response);
            return;
        }

        String principal = resolvePrincipal(request);

        if (detectHighFrequency(principal, request)) {
            metricsService.recordDlpViolation("high_frequency");
            log.warn("DLP: high-frequency access from {} on {}", principal, request.getServletPath());
        }

        ContentCachingResponseWrapper wrappedResponse = new ContentCachingResponseWrapper(response);
        chain.doFilter(request, wrappedResponse);

        int responseSize = wrappedResponse.getContentSize();
        if (responseSize > maxResponseBytes) {
            metricsService.recordDlpViolation("large_response");
            log.warn("DLP: large response ({} bytes) to {} on {} {}",
                    responseSize, principal, request.getMethod(), request.getServletPath());
        }

        if (isBulkEndpoint(request) && responseSize > 0) {
            metricsService.recordDlpDataAccess(responseSize);
        }

        wrappedResponse.copyBodyToResponse();
    }

    private boolean detectHighFrequency(String principal, HttpServletRequest request) {
        if ("anonymous".equals(principal)) return false;

        String key = principal + ":" + categorize(request);
        AccessWindow window = accessWindows.compute(key, (k, w) -> {
            if (w == null || w.isExpired()) return new AccessWindow();
            return w;
        });

        return window.count.incrementAndGet() > maxRequestsPerMinute;
    }

    private String categorize(HttpServletRequest request) {
        String path = request.getServletPath();
        if (path.contains("/export")) return "export";
        if (path.contains("/gdpr")) return "gdpr";
        if (path.contains("/users")) return "users";
        return "general";
    }

    private boolean isBulkEndpoint(HttpServletRequest request) {
        String path = request.getServletPath();
        return path.contains("/export") || path.contains("/gdpr")
                || ("GET".equals(request.getMethod()) && path.matches(".*/\\w+$") && !path.contains("/me"));
    }

    private String resolvePrincipal(HttpServletRequest request) {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth != null && auth.isAuthenticated() && !"anonymousUser".equals(auth.getName())) {
            return auth.getName();
        }
        String forwarded = request.getHeader("X-Forwarded-For");
        if (forwarded != null && !forwarded.isBlank()) {
            return forwarded.split(",")[0].trim();
        }
        return request.getRemoteAddr();
    }

    private boolean isExcluded(String path) {
        return path.startsWith("/actuator") || path.startsWith("/swagger-ui") || path.startsWith("/api-docs");
    }

    private static class AccessWindow {
        final Instant start = Instant.now();
        final AtomicInteger count = new AtomicInteger(0);

        boolean isExpired() {
            return Instant.now().isAfter(start.plusSeconds(60));
        }
    }
}
