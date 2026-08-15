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
        String email = "test@moov-africa.bf";
        String role = "CHEF_PRODUIT";

        String token = jwtTokenProvider.generateAccessToken(userId, email, role);

        assertNotNull(token);
        assertTrue(jwtTokenProvider.validateToken(token));
    }

    @Test
    void getEmailFromToken_shouldReturnCorrectEmail() {
        UUID userId = UUID.randomUUID();
        String email = "chef@moov-africa.bf";

        String token = jwtTokenProvider.generateAccessToken(userId, email, "ADMIN_SYSTEME");

        assertEquals(email, jwtTokenProvider.getEmailFromToken(token));
    }

    @Test
    void getUserIdFromToken_shouldReturnCorrectId() {
        UUID userId = UUID.randomUUID();

        String token = jwtTokenProvider.generateAccessToken(userId, "user@moov.bf", "CHEF_PRODUIT");

        assertEquals(userId, jwtTokenProvider.getUserIdFromToken(token));
    }

    @Test
    void getRoleFromToken_shouldReturnCorrectRole() {
        String role = "COMMUNITY_MANAGER";

        String token = jwtTokenProvider.generateAccessToken(UUID.randomUUID(), "cm@moov.bf", role);

        assertEquals(role, jwtTokenProvider.getRoleFromToken(token));
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

        String token = jwtTokenProvider.generateRefreshToken(userId, email, role);

        assertTrue(jwtTokenProvider.validateToken(token));
        assertEquals(email, jwtTokenProvider.getEmailFromToken(token));
        assertEquals(userId, jwtTokenProvider.getUserIdFromToken(token));
        assertEquals(role, jwtTokenProvider.getRoleFromToken(token));
    }

    @Test
    void tokenSignedWithDifferentKey_shouldBeInvalid() {
        JwtTokenProvider otherProvider = new JwtTokenProvider(
                "AutreCleSecreteDifferenteAvecAuMoins64CaracteresRemplissagePour512!",
                ACCESS_EXP, REFRESH_EXP);

        String token = otherProvider.generateAccessToken(UUID.randomUUID(), "a@b.com", "ADMIN_SYSTEME");

        assertFalse(jwtTokenProvider.validateToken(token));
    }
}
