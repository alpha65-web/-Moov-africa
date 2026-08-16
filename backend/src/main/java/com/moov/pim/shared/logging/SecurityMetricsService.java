package com.moov.pim.shared.logging;

import io.micrometer.core.instrument.Counter;
import io.micrometer.core.instrument.MeterRegistry;
import org.springframework.stereotype.Service;

@Service
public class SecurityMetricsService {

    private final Counter loginSuccess;
    private final Counter loginFailed;
    private final Counter mfaChallenges;
    private final Counter mfaFailures;
    private final Counter accountLockouts;
    private final Counter tokenRefreshes;
    private final Counter accessDenied;
    private final Counter dlpViolations;
    private final io.micrometer.core.instrument.DistributionSummary dlpDataAccess;

    public SecurityMetricsService(MeterRegistry registry) {
        this.loginSuccess = Counter.builder("security.auth.login.success")
                .description("Successful login attempts")
                .register(registry);
        this.loginFailed = Counter.builder("security.auth.login.failed")
                .description("Failed login attempts")
                .register(registry);
        this.mfaChallenges = Counter.builder("security.auth.mfa.challenges")
                .description("MFA challenges presented")
                .register(registry);
        this.mfaFailures = Counter.builder("security.auth.mfa.failures")
                .description("Failed MFA verifications")
                .register(registry);
        this.accountLockouts = Counter.builder("security.auth.lockouts")
                .description("Account lockout events")
                .register(registry);
        this.tokenRefreshes = Counter.builder("security.auth.token.refresh")
                .description("Token refresh operations")
                .register(registry);
        this.accessDenied = Counter.builder("security.auth.access.denied")
                .description("Access denied events")
                .register(registry);
        this.dlpViolations = Counter.builder("security.dlp.violations")
                .description("DLP policy violations detected")
                .register(registry);
        this.dlpDataAccess = io.micrometer.core.instrument.DistributionSummary.builder("security.dlp.data.access.bytes")
                .description("Data volume accessed via bulk endpoints")
                .baseUnit("bytes")
                .register(registry);
    }

    public void recordLoginSuccess() { loginSuccess.increment(); }
    public void recordLoginFailed() { loginFailed.increment(); }
    public void recordMfaChallenge() { mfaChallenges.increment(); }
    public void recordMfaFailure() { mfaFailures.increment(); }
    public void recordAccountLockout() { accountLockouts.increment(); }
    public void recordTokenRefresh() { tokenRefreshes.increment(); }
    public void recordAccessDenied() { accessDenied.increment(); }
    public void recordDlpViolation(String type) { dlpViolations.increment(); }
    public void recordDlpDataAccess(long bytes) { dlpDataAccess.record(bytes); }
}
