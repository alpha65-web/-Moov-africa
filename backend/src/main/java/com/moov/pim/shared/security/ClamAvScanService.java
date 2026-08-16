package com.moov.pim.shared.security;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.io.BufferedReader;
import java.io.InputStream;
import java.io.InputStreamReader;
import java.io.OutputStream;
import java.net.Socket;
import java.nio.ByteBuffer;
import java.nio.charset.StandardCharsets;

@Service
public class ClamAvScanService {

    private static final Logger log = LoggerFactory.getLogger(ClamAvScanService.class);

    @Value("${pim.clamav.host:clamav}")
    private String clamavHost;

    @Value("${pim.clamav.port:3310}")
    private int clamavPort;

    @Value("${pim.clamav.enabled:false}")
    private boolean enabled;

    public ScanResult scan(InputStream inputStream) {
        if (!enabled) {
            return new ScanResult(true, "AV scanning disabled");
        }

        try (Socket socket = new Socket(clamavHost, clamavPort)) {
            socket.setSoTimeout(30_000);
            OutputStream out = socket.getOutputStream();

            out.write("zINSTREAM\0".getBytes(StandardCharsets.US_ASCII));

            byte[] buffer = new byte[8192];
            int bytesRead;
            while ((bytesRead = inputStream.read(buffer)) != -1) {
                out.write(ByteBuffer.allocate(4).putInt(bytesRead).array());
                out.write(buffer, 0, bytesRead);
            }
            out.write(new byte[]{0, 0, 0, 0});
            out.flush();

            BufferedReader reader = new BufferedReader(
                    new InputStreamReader(socket.getInputStream(), StandardCharsets.US_ASCII));
            String response = reader.readLine();

            if (response == null) {
                log.warn("ClamAV returned null response");
                return new ScanResult(false, "No response from AV scanner");
            }

            boolean clean = response.contains("OK") && !response.contains("FOUND");
            log.info("ClamAV scan result: {}", clean ? "CLEAN" : "INFECTED");
            return new ScanResult(clean, response.trim());
        } catch (Exception e) {
            log.error("ClamAV scan failed: {}", e.getMessage());
            return new ScanResult(false, "AV scan error: " + e.getMessage());
        }
    }

    public record ScanResult(boolean clean, String message) {}
}
