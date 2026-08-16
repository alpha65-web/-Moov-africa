package com.moov.pim.permissions.security;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;

class JwtTokenProviderTest {

    private JwtTokenProvider jwtTokenProvider;
    private static final String SECRET = "MonSuperSecretDeTestAvecAuMoins64CaracteresDeRemplissagePourHMAC512!";
    private static final long ACCESS_EXP = 3_600_000;
    private static final long REFRESH_EXP = 86_400_000;

    @BeforeEach
    void setUp() {
        jwtTokenProvider = new JwtTokenProvider(SECRET, ACCESS_EXP, REFRESH_EXP);
    }

    @Test
    void generateAccessToken_shouldReturnValidToken() {
        UUID userId = UUID.randomUUID();
        String token = jwtTokenProvider.generateAccessToken(userId, "test@moov-africa.bf", "CHEF_PRODUIT", 0);

        assertNotNull(token);
        assertTrue(jwtTokenProvider.validateToken(token));
        assertEquals("access", jwtTokenProvider.getTokenType(token));
    }

    @Test
    void getEmailFromToken_shouldReturnCorrectEmail() {
        UUID userId = UUID.randomUUID();
        String email = "chef@moov-africa.bf";
        String token = jwtTokenProvider.generateAccessToken(userId, email, "ADMIN_SYSTEME", 0);

        assertEquals(email, jwtTokenProvider.getEmailFromToken(token));
    }

    @Test
    void getUserIdFromToken_shouldReturnCorrectId() {
        UUID userId = UUID.randomUUID();
        String token = jwtTokenProvider.generateAccessToken(userId, "user@moov.bf", "CHEF_PRODUIT", 0);

        assertEquals(userId, jwtTokenProvider.getUserIdFromToken(token));
    }

    @Test
    void getRoleFromToken_shouldReturnCorrectRole() {
        String role = "COMMUNITY_MANAGER";
        String token = jwtTokenProvider.generateAccessToken(UUID.randomUUID(), "cm@moov.bf", role, 0);

        assertEquals(role, jwtTokenProvider.getRoleFromToken(token));
    }

    @Test
    void getTokenVersionFromToken_shouldReturnCorrectVersion() {
        String token = jwtTokenProvider.generateAccessToken(UUID.randomUUID(), "u@moov.bf", "ADMIN_SYSTEME", 5);

        assertEquals(5, jwtTokenProvider.getTokenVersionFromToken(token));
    }

    @Test
    void validateToken_shouldReturnFalseForInvalidToken() {
        assertFalse(jwtTokenProvider.validateToken("token.invalide.ici"));
    }

    @Test
    void validateToken_shouldReturnFalseForNullToken() {
        assertFalse(jwtTokenProvider.validateToken(null));
    }

    @Test
    void generateRefreshToken_shouldBeValidAndContainSameData() {
        UUID userId = UUID.randomUUID();
        String email = "refresh@moov.bf";
        String role = "ANALYSTE_MARKETING";
        String token = jwtTokenProvider.generateRefreshToken(userId, email, role, 0);

        assertTrue(jwtTokenProvider.validateToken(token));
        assertEquals(email, jwtTokenProvider.getEmailFromToken(token));
        assertEquals(userId, jwtTokenProvider.getUserIdFromToken(token));
        assertEquals(role, jwtTokenProvider.getRoleFromToken(token));
        assertEquals("refresh", jwtTokenProvider.getTokenType(token));
    }

    @Test
    void tokenSignedWithDifferentKey_shouldBeInvalid() {
        JwtTokenProvider otherProvider = new JwtTokenProvider(
                "AutreCleSecreteDifferenteAvecAuMoins64CaracteresRemplissagePour512!",
                ACCESS_EXP, REFRESH_EXP);

        String token = otherProvider.generateAccessToken(UUID.randomUUID(), "a@b.com", "ADMIN_SYSTEME", 0);

        assertFalse(jwtTokenProvider.validateToken(token));
    }

    @Test
    void hashToken_shouldReturnConsistentHash() {
        String token = "some-token-value";
        String hash1 = JwtTokenProvider.hashToken(token);
        String hash2 = JwtTokenProvider.hashToken(token);

        assertEquals(hash1, hash2);
        assertEquals(64, hash1.length());
    }

    @Test
    void constructor_shouldRejectShortSecret() {
        assertThrows(IllegalArgumentException.class,
                () -> new JwtTokenProvider("short", ACCESS_EXP, REFRESH_EXP));
    }
}
