package com.moov.pim.shared.security;

import com.moov.pim.shared.logging.SecurityMetricsService;
import jakarta.servlet.FilterChain;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.core.context.SecurityContextHolder;

import java.lang.reflect.Field;

import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class DlpFilterTest {

    @Mock private SecurityMetricsService metricsService;
    private DlpFilter filter;

    @BeforeEach
    void setUp() throws Exception {
        filter = new DlpFilter(metricsService);
        setField(filter, "maxResponseBytes", 5242880L);
        setField(filter, "maxRequestsPerMinute", 200);
        setField(filter, "enabled", true);
    }

    @Test
    void doFilter_shouldSkipWhenDisabled() throws Exception {
        setField(filter, "enabled", false);
        var request = mock(HttpServletRequest.class);
        var response = mock(HttpServletResponse.class);
        var chain = mock(FilterChain.class);

        filter.doFilterInternal(request, response, chain);

        verify(chain).doFilter(request, response);
    }

    @Test
    void doFilter_shouldSkipExcludedPaths() throws Exception {
        var request = mock(HttpServletRequest.class);
        var response = mock(HttpServletResponse.class);
        var chain = mock(FilterChain.class);
        when(request.getServletPath()).thenReturn("/actuator/health");

        filter.doFilterInternal(request, response, chain);

        verify(chain).doFilter(request, response);
    }

    @Test
    void doFilter_shouldPassNormalRequests() throws Exception {
        SecurityContextHolder.clearContext();
        var request = mock(HttpServletRequest.class);
        var response = mock(HttpServletResponse.class);
        var chain = mock(FilterChain.class);
        when(request.getServletPath()).thenReturn("/offers");
        when(request.getMethod()).thenReturn("GET");
        when(request.getRemoteAddr()).thenReturn("10.0.0.1");
        when(request.getHeader("X-Forwarded-For")).thenReturn(null);

        filter.doFilterInternal(request, response, chain);

        verify(chain).doFilter(eq(request), any());
    }

    private static void setField(Object target, String fieldName, Object value) {
        try {
            Field field = target.getClass().getDeclaredField(fieldName);
            field.setAccessible(true);
            field.set(target, value);
        } catch (Exception e) {
            throw new RuntimeException(e);
        }
    }
}
