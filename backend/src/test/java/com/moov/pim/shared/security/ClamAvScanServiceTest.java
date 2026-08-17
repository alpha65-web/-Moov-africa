package com.moov.pim.shared.security;

import org.junit.jupiter.api.Test;

import java.io.ByteArrayInputStream;
import java.lang.reflect.Field;

import static org.junit.jupiter.api.Assertions.*;

class ClamAvScanServiceTest {

    @Test
    void scan_shouldReturnCleanWhenDisabled() throws Exception {
        ClamAvScanService service = new ClamAvScanService();
        setField(service, "enabled", false);

        ClamAvScanService.ScanResult result = service.scan(
                new ByteArrayInputStream("test content".getBytes()));

        assertTrue(result.clean());
        assertEquals("AV scanning disabled", result.message());
    }

    @Test
    void scan_shouldReturnErrorWhenEnabledButNoClamAv() throws Exception {
        ClamAvScanService service = new ClamAvScanService();
        setField(service, "enabled", true);
        setField(service, "clamavHost", "localhost");
        setField(service, "clamavPort", 59999);

        ClamAvScanService.ScanResult result = service.scan(
                new ByteArrayInputStream("test content".getBytes()));

        assertFalse(result.clean());
        assertTrue(result.message().startsWith("AV scan error:"));
    }

    @Test
    void scanResult_record_shouldExposeFields() {
        var result = new ClamAvScanService.ScanResult(true, "OK");

        assertTrue(result.clean());
        assertEquals("OK", result.message());
    }

    @Test
    void scanResult_infected() {
        var result = new ClamAvScanService.ScanResult(false, "Eicar-Test-Signature FOUND");

        assertFalse(result.clean());
        assertTrue(result.message().contains("FOUND"));
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
