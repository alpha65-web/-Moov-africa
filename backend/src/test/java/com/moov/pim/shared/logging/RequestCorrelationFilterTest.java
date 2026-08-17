package com.moov.pim.shared.logging;

import jakarta.servlet.FilterChain;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.junit.jupiter.api.Test;
import org.slf4j.MDC;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;

class RequestCorrelationFilterTest {

    private final RequestCorrelationFilter filter = new RequestCorrelationFilter();

    @Test
    void doFilter_shouldUseProvidedCorrelationId() throws Exception {
        var request = mock(HttpServletRequest.class);
        var response = mock(HttpServletResponse.class);
        var chain = mock(FilterChain.class);
        when(request.getHeader("X-Correlation-ID")).thenReturn("abc-123");

        doAnswer(inv -> {
            assertEquals("abc-123", MDC.get("correlationId"));
            return null;
        }).when(chain).doFilter(request, response);

        filter.doFilterInternal(request, response, chain);

        verify(response).setHeader("X-Correlation-ID", "abc-123");
        verify(chain).doFilter(request, response);
        assertNull(MDC.get("correlationId"));
    }

    @Test
    void doFilter_shouldGenerateCorrelationIdIfMissing() throws Exception {
        var request = mock(HttpServletRequest.class);
        var response = mock(HttpServletResponse.class);
        var chain = mock(FilterChain.class);
        when(request.getHeader("X-Correlation-ID")).thenReturn(null);

        doAnswer(inv -> {
            assertNotNull(MDC.get("correlationId"));
            return null;
        }).when(chain).doFilter(request, response);

        filter.doFilterInternal(request, response, chain);

        verify(response).setHeader(eq("X-Correlation-ID"), argThat(s -> s != null && !s.isBlank()));
        assertNull(MDC.get("correlationId"));
    }

    @Test
    void doFilter_shouldCleanMdcEvenOnException() throws Exception {
        var request = mock(HttpServletRequest.class);
        var response = mock(HttpServletResponse.class);
        var chain = mock(FilterChain.class);
        when(request.getHeader("X-Correlation-ID")).thenReturn("err-456");
        doThrow(new RuntimeException("boom")).when(chain).doFilter(request, response);

        assertThrows(RuntimeException.class,
                () -> filter.doFilterInternal(request, response, chain));
        assertNull(MDC.get("correlationId"));
    }
}
