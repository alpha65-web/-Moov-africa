package com.moov.pim.permissions.security;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.time.Instant;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.AtomicInteger;

@Component
public class RateLimitFilter extends OncePerRequestFilter {

    private static final int MAX_ATTEMPTS = 10;
    private static final long WINDOW_SECONDS = 60;

    private final Map<String, RateWindow> windows = new ConcurrentHashMap<>();

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain chain)
            throws ServletException, IOException {

        if (!isRateLimited(request)) {
            chain.doFilter(request, response);
            return;
        }

        String key = clientKey(request);
        RateWindow window = windows.compute(key, (k, w) -> {
            if (w == null || w.isExpired()) return new RateWindow();
            return w;
        });

        if (window.count.incrementAndGet() > MAX_ATTEMPTS) {
            response.setStatus(HttpStatus.TOO_MANY_REQUESTS.value());
            response.setContentType(MediaType.APPLICATION_JSON_VALUE);
            response.getWriter().write(
                    "{\"status\":429,\"message\":\"Trop de tentatives. Réessayez dans quelques instants.\"}");
            return;
        }

        chain.doFilter(request, response);
    }

    private boolean isRateLimited(HttpServletRequest request) {
        String path = request.getServletPath();
        return "POST".equalsIgnoreCase(request.getMethod())
                && (path.equals("/auth/login") || path.equals("/auth/refresh") || path.equals("/auth/register"));
    }

    private String clientKey(HttpServletRequest request) {
        String forwarded = request.getHeader("X-Forwarded-For");
        String ip = (forwarded != null && !forwarded.isBlank())
                ? forwarded.split(",")[0].trim()
                : request.getRemoteAddr();
        return ip + ":" + request.getServletPath();
    }

    private static class RateWindow {
        final Instant start = Instant.now();
        final AtomicInteger count = new AtomicInteger(0);

        boolean isExpired() {
            return Instant.now().isAfter(start.plusSeconds(WINDOW_SECONDS));
        }
    }
}
