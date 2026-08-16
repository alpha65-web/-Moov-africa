package com.moov.pim.permissions.security;

import io.jsonwebtoken.Claims;
import io.jsonwebtoken.JwtException;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import javax.crypto.SecretKey;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.Date;
import java.util.HexFormat;
import java.util.UUID;

@Component
public class JwtTokenProvider {

    private final SecretKey key;
    private final long accessTokenExpiration;
    private final long refreshTokenExpiration;

    public JwtTokenProvider(
            @Value("${pim.jwt.secret}") String secret,
            @Value("${pim.jwt.access-token-expiration}") long accessTokenExpiration,
            @Value("${pim.jwt.refresh-token-expiration}") long refreshTokenExpiration) {
        if (secret.length() < 32) {
            throw new IllegalArgumentException("JWT secret must be at least 32 characters");
        }
        this.key = Keys.hmacShaKeyFor(secret.getBytes(StandardCharsets.UTF_8));
        this.accessTokenExpiration = accessTokenExpiration;
        this.refreshTokenExpiration = refreshTokenExpiration;
    }

    public String generateAccessToken(UUID userId, String email, String role, int tokenVersion, String fingerprint) {
        return buildToken(userId, email, role, tokenVersion, accessTokenExpiration, "access", fingerprint);
    }

    public String generateRefreshToken(UUID userId, String email, String role, int tokenVersion, String fingerprint) {
        return buildToken(userId, email, role, tokenVersion, refreshTokenExpiration, "refresh", fingerprint);
    }

    public String generateFingerprint() {
        byte[] bytes = new byte[32];
        new java.security.SecureRandom().nextBytes(bytes);
        return HexFormat.of().formatHex(bytes);
    }

    public String hashFingerprint(String fingerprint) {
        return hashToken(fingerprint);
    }

    private String buildToken(UUID userId, String email, String role, int tokenVersion,
                              long expiration, String type, String fingerprintHash) {
        Date now = new Date();
        var builder = Jwts.builder()
                .subject(email)
                .claim("userId", userId.toString())
                .claim("role", role)
                .claim("tv", tokenVersion)
                .claim("type", type)
                .claim("jti", UUID.randomUUID().toString())
                .issuedAt(now)
                .expiration(new Date(now.getTime() + expiration))
                .signWith(key);

        if (fingerprintHash != null) {
            builder.claim("fph", fingerprintHash);
        }

        return builder.compact();
    }

    public String getFingerprintHashFromToken(String token) {
        return parseClaims(token).get("fph", String.class);
    }

    public String getEmailFromToken(String token) {
        return parseClaims(token).getSubject();
    }

    public UUID getUserIdFromToken(String token) {
        return UUID.fromString(parseClaims(token).get("userId", String.class));
    }

    public String getRoleFromToken(String token) {
        return parseClaims(token).get("role", String.class);
    }

    public int getTokenVersionFromToken(String token) {
        return parseClaims(token).get("tv", Integer.class);
    }

    public String getTokenType(String token) {
        String type = parseClaims(token).get("type", String.class);
        return type != null ? type : "access";
    }

    public boolean validateToken(String token) {
        try {
            parseClaims(token);
            return true;
        } catch (JwtException | IllegalArgumentException e) {
            return false;
        }
    }

    public long getRefreshTokenExpiration() {
        return refreshTokenExpiration;
    }

    public static String hashToken(String token) {
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            byte[] hash = digest.digest(token.getBytes(StandardCharsets.UTF_8));
            return HexFormat.of().formatHex(hash);
        } catch (NoSuchAlgorithmException e) {
            throw new IllegalStateException("SHA-256 not available", e);
        }
    }

    private Claims parseClaims(String token) {
        return Jwts.parser()
                .verifyWith(key)
                .build()
                .parseSignedClaims(token)
                .getPayload();
    }
}
