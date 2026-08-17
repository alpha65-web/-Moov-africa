package com.moov.pim.shared.security;

import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.*;

class EncryptionServiceTest {

    private final EncryptionService encryptionService =
            new EncryptionService("MaSuperCleDEncryptionPourLesTests!");

    @Test
    void isEnabled_shouldReturnTrueWithKey() {
        assertTrue(encryptionService.isEnabled());
    }

    @Test
    void isEnabled_shouldReturnFalseWithoutKey() {
        EncryptionService disabled = new EncryptionService(null);

        assertFalse(disabled.isEnabled());
    }

    @Test
    void isEnabled_shouldReturnFalseWithBlankKey() {
        EncryptionService disabled = new EncryptionService("   ");

        assertFalse(disabled.isEnabled());
    }

    @Test
    void encrypt_shouldReturnEncPrefixed() {
        String encrypted = encryptionService.encrypt("données sensibles");

        assertNotNull(encrypted);
        assertTrue(encrypted.startsWith("ENC:"));
        assertNotEquals("données sensibles", encrypted);
    }

    @Test
    void decrypt_shouldReturnOriginalText() {
        String original = "Mon texte confidentiel 123!";
        String encrypted = encryptionService.encrypt(original);
        String decrypted = encryptionService.decrypt(encrypted);

        assertEquals(original, decrypted);
    }

    @Test
    void encrypt_shouldReturnDifferentCiphertextEachTime() {
        String plaintext = "même texte";
        String enc1 = encryptionService.encrypt(plaintext);
        String enc2 = encryptionService.encrypt(plaintext);

        assertNotEquals(enc1, enc2);
        assertEquals(plaintext, encryptionService.decrypt(enc1));
        assertEquals(plaintext, encryptionService.decrypt(enc2));
    }

    @Test
    void encrypt_shouldReturnNullForNull() {
        assertNull(encryptionService.encrypt(null));
    }

    @Test
    void decrypt_shouldReturnNullForNull() {
        assertNull(encryptionService.decrypt(null));
    }

    @Test
    void decrypt_shouldReturnPlaintextIfNotEncrypted() {
        String plain = "pas chiffré";

        assertEquals(plain, encryptionService.decrypt(plain));
    }

    @Test
    void decrypt_shouldFailWithWrongKey() {
        String encrypted = encryptionService.encrypt("secret");
        EncryptionService otherService = new EncryptionService("AutreCleComplètementDifférente!!");

        assertThrows(IllegalStateException.class, () -> otherService.decrypt(encrypted));
    }

    @Test
    void encryptDecrypt_shouldHandleEmptyString() {
        String encrypted = encryptionService.encrypt("");
        String decrypted = encryptionService.decrypt(encrypted);

        assertEquals("", decrypted);
    }

    @Test
    void encryptDecrypt_shouldHandleUnicode() {
        String unicode = "Données avec accents éàü et emoji 🔐";
        String encrypted = encryptionService.encrypt(unicode);
        String decrypted = encryptionService.decrypt(encrypted);

        assertEquals(unicode, decrypted);
    }

    @Test
    void disabledService_shouldPassthroughEncrypt() {
        EncryptionService disabled = new EncryptionService(null);

        assertEquals("clair", disabled.encrypt("clair"));
    }

    @Test
    void disabledService_shouldPassthroughDecrypt() {
        EncryptionService disabled = new EncryptionService(null);

        assertEquals("clair", disabled.decrypt("clair"));
    }
}
