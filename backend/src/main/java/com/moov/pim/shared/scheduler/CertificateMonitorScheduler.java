package com.moov.pim.shared.scheduler;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import javax.net.ssl.SSLSession;
import javax.net.ssl.SSLSocket;
import javax.net.ssl.SSLSocketFactory;
import java.security.cert.X509Certificate;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.Date;
import java.util.List;
import java.util.Map;

@Component
public class CertificateMonitorScheduler {

    private static final Logger log = LoggerFactory.getLogger(CertificateMonitorScheduler.class);
    private static final int WARNING_DAYS = 30;
    private static final int CRITICAL_DAYS = 7;

    @Value("${pim.certificate-monitor.endpoints:}")
    private String monitoredEndpoints;

    @Scheduled(cron = "0 0 6 * * *")
    public void checkCertificateExpiry() {
        if (monitoredEndpoints == null || monitoredEndpoints.isBlank()) {
            return;
        }

        List<Map<String, String>> results = new ArrayList<>();

        for (String endpoint : monitoredEndpoints.split(",")) {
            String trimmed = endpoint.trim();
            if (trimmed.isEmpty()) continue;

            String[] parts = trimmed.split(":");
            String host = parts[0];
            int port = parts.length > 1 ? Integer.parseInt(parts[1]) : 443;

            try {
                checkEndpoint(host, port, results);
            } catch (Exception e) {
                log.error("Failed to check certificate for {}:{}: {}", host, port, e.getMessage());
                results.add(Map.of("endpoint", trimmed, "status", "ERROR", "message", e.getMessage()));
            }
        }

        for (Map<String, String> result : results) {
            String status = result.get("status");
            if ("CRITICAL".equals(status)) {
                log.error("CERTIFICATE EXPIRY CRITICAL: {} — expires in {} days ({})",
                        result.get("endpoint"), result.get("daysUntilExpiry"), result.get("expiryDate"));
            } else if ("WARNING".equals(status)) {
                log.warn("CERTIFICATE EXPIRY WARNING: {} — expires in {} days ({})",
                        result.get("endpoint"), result.get("daysUntilExpiry"), result.get("expiryDate"));
            } else if ("OK".equals(status)) {
                log.info("Certificate OK: {} — expires in {} days", result.get("endpoint"), result.get("daysUntilExpiry"));
            }
        }
    }

    private void checkEndpoint(String host, int port, List<Map<String, String>> results) throws Exception {
        SSLSocketFactory factory = (SSLSocketFactory) SSLSocketFactory.getDefault();
        try (SSLSocket socket = (SSLSocket) factory.createSocket(host, port)) {
            socket.setSoTimeout(5000);
            socket.startHandshake();
            SSLSession session = socket.getSession();
            for (var cert : session.getPeerCertificates()) {
                if (cert instanceof X509Certificate x509) {
                    Date expiry = x509.getNotAfter();
                    long daysUntilExpiry = ChronoUnit.DAYS.between(Instant.now(), expiry.toInstant());
                    String status = daysUntilExpiry <= CRITICAL_DAYS ? "CRITICAL"
                            : daysUntilExpiry <= WARNING_DAYS ? "WARNING" : "OK";
                    results.add(Map.of(
                            "endpoint", host + ":" + port,
                            "subject", x509.getSubjectX500Principal().getName(),
                            "expiryDate", expiry.toString(),
                            "daysUntilExpiry", String.valueOf(daysUntilExpiry),
                            "status", status
                    ));
                    break;
                }
            }
        }
    }
}
