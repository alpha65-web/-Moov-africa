package com.moov.pim.shared.logging;

import io.micrometer.core.instrument.MeterRegistry;
import io.micrometer.core.instrument.simple.SimpleMeterRegistry;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.*;

class SecurityMetricsServiceTest {

    private MeterRegistry registry;
    private SecurityMetricsService metricsService;

    @BeforeEach
    void setUp() {
        registry = new SimpleMeterRegistry();
        metricsService = new SecurityMetricsService(registry);
    }

    @Test
    void recordLoginSuccess_shouldIncrementCounter() {
        metricsService.recordLoginSuccess();
        metricsService.recordLoginSuccess();

        assertEquals(2.0, registry.counter("security.auth.login.success").count());
    }

    @Test
    void recordLoginFailed_shouldIncrementCounter() {
        metricsService.recordLoginFailed();

        assertEquals(1.0, registry.counter("security.auth.login.failed").count());
    }

    @Test
    void recordMfaChallenge_shouldIncrementCounter() {
        metricsService.recordMfaChallenge();

        assertEquals(1.0, registry.counter("security.auth.mfa.challenges").count());
    }

    @Test
    void recordMfaFailure_shouldIncrementCounter() {
        metricsService.recordMfaFailure();

        assertEquals(1.0, registry.counter("security.auth.mfa.failures").count());
    }

    @Test
    void recordAccountLockout_shouldIncrementCounter() {
        metricsService.recordAccountLockout();

        assertEquals(1.0, registry.counter("security.auth.lockouts").count());
    }

    @Test
    void recordTokenRefresh_shouldIncrementCounter() {
        metricsService.recordTokenRefresh();

        assertEquals(1.0, registry.counter("security.auth.token.refresh").count());
    }

    @Test
    void recordAccessDenied_shouldIncrementCounter() {
        metricsService.recordAccessDenied();
        metricsService.recordAccessDenied();
        metricsService.recordAccessDenied();

        assertEquals(3.0, registry.counter("security.auth.access.denied").count());
    }

    @Test
    void recordDlpViolation_shouldIncrementCounter() {
        metricsService.recordDlpViolation("bulk_export");

        assertEquals(1.0, registry.counter("security.dlp.violations").count());
    }

    @Test
    void recordDlpDataAccess_shouldRecordBytes() {
        metricsService.recordDlpDataAccess(1024);
        metricsService.recordDlpDataAccess(2048);

        var summary = registry.summary("security.dlp.data.access.bytes");
        assertEquals(2, summary.count());
        assertEquals(3072.0, summary.totalAmount());
    }
}
