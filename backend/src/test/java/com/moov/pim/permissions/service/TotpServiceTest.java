package com.moov.pim.permissions.service;

import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.*;

class TotpServiceTest {

    private final TotpService totpService = new TotpService();

    @Test
    void generateSecret_shouldReturnNonEmptyBase32String() {
        String secret = totpService.generateSecret();

        assertNotNull(secret);
        assertFalse(secret.isEmpty());
        assertFalse(secret.contains("="));
        assertTrue(secret.matches("[A-Z2-7]+"));
    }

    @Test
    void generateSecret_shouldReturnUniqueSecrets() {
        String s1 = totpService.generateSecret();
        String s2 = totpService.generateSecret();

        assertNotEquals(s1, s2);
    }

    @Test
    void buildOtpAuthUri_shouldContainCorrectFormat() {
        String secret = totpService.generateSecret();
        String email = "user@moov-africa.bf";

        String uri = totpService.buildOtpAuthUri(secret, email);

        assertTrue(uri.startsWith("otpauth://totp/MoovAfrica:"));
        assertTrue(uri.contains("secret=" + secret));
        assertTrue(uri.contains("issuer=MoovAfrica"));
        assertTrue(uri.contains("algorithm=SHA1"));
        assertTrue(uri.contains("digits=6"));
        assertTrue(uri.contains("period=30"));
        assertTrue(uri.contains(email));
    }

    @Test
    void verifyCode_shouldRejectNull() {
        String secret = totpService.generateSecret();

        assertFalse(totpService.verifyCode(secret, null));
    }

    @Test
    void verifyCode_shouldRejectWrongLength() {
        String secret = totpService.generateSecret();

        assertFalse(totpService.verifyCode(secret, "123"));
        assertFalse(totpService.verifyCode(secret, "1234567"));
    }

    @Test
    void verifyCode_shouldRejectInvalidCode() {
        String secret = totpService.generateSecret();

        assertFalse(totpService.verifyCode(secret, "000000"));
    }
}
