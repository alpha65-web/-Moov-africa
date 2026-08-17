package com.moov.pim.permissions.security;

import jakarta.servlet.FilterChain;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.junit.jupiter.api.Test;

import java.io.PrintWriter;
import java.io.StringWriter;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

class RateLimitFilterTest {

    private final RateLimitFilter filter = new RateLimitFilter();

    @Test
    void doFilter_shouldPassStaticPaths() throws Exception {
        var request = mock(HttpServletRequest.class);
        var response = mock(HttpServletResponse.class);
        var chain = mock(FilterChain.class);
        when(request.getServletPath()).thenReturn("/actuator/health");

        filter.doFilterInternal(request, response, chain);

        verify(chain).doFilter(request, response);
        verify(response, never()).setHeader(eq("X-RateLimit-Limit"), any());
    }

    @Test
    void doFilter_shouldSetRateLimitHeaders() throws Exception {
        var request = mock(HttpServletRequest.class);
        var response = mock(HttpServletResponse.class);
        var chain = mock(FilterChain.class);
        when(request.getServletPath()).thenReturn("/offers");
        when(request.getMethod()).thenReturn("GET");
        when(request.getRemoteAddr()).thenReturn("192.168.1.1");
        when(request.getHeader("X-Forwarded-For")).thenReturn(null);

        filter.doFilterInternal(request, response, chain);

        verify(response).setHeader(eq("X-RateLimit-Limit"), eq("100"));
        verify(response).setHeader(eq("X-RateLimit-Remaining"), any());
        verify(chain).doFilter(request, response);
    }

    @Test
    void doFilter_shouldApplyAuthLimitForLogin() throws Exception {
        var request = mock(HttpServletRequest.class);
        var response = mock(HttpServletResponse.class);
        var chain = mock(FilterChain.class);
        when(request.getServletPath()).thenReturn("/auth/login");
        when(request.getMethod()).thenReturn("POST");
        when(request.getRemoteAddr()).thenReturn("10.0.0.1");
        when(request.getHeader("X-Forwarded-For")).thenReturn(null);

        filter.doFilterInternal(request, response, chain);

        verify(response).setHeader(eq("X-RateLimit-Limit"), eq("10"));
    }

    @Test
    void doFilter_shouldReturn429WhenLimitExceeded() throws Exception {
        var request = mock(HttpServletRequest.class);
        var response = mock(HttpServletResponse.class);
        var chain = mock(FilterChain.class);
        when(request.getServletPath()).thenReturn("/auth/login");
        when(request.getMethod()).thenReturn("POST");
        when(request.getRemoteAddr()).thenReturn("1.2.3.4");
        when(request.getHeader("X-Forwarded-For")).thenReturn(null);

        for (int i = 0; i < 10; i++) {
            var resp = mock(HttpServletResponse.class);
            filter.doFilterInternal(request, resp, chain);
        }

        var writer = new StringWriter();
        when(response.getWriter()).thenReturn(new PrintWriter(writer));
        filter.doFilterInternal(request, response, chain);

        verify(response).setStatus(429);
        assertTrue(writer.toString().contains("Trop de"));
    }
}
