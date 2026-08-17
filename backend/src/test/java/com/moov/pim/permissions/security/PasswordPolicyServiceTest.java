package com.moov.pim.permissions.security;

import com.moov.pim.permissions.security.PasswordPolicyService.PasswordPolicyViolationException;
import org.junit.jupiter.api.Test;

import java.util.List;

import static org.junit.jupiter.api.Assertions.*;

class PasswordPolicyServiceTest {

    private final PasswordPolicyService policyService = new PasswordPolicyService();

    @Test
    void validate_shouldPassForStrongPassword() {
        assertDoesNotThrow(() -> policyService.validate("MonMotDePasse1!"));
    }

    @Test
    void check_shouldRejectTooShort() {
        List<String> violations = policyService.check("Ab1!");

        assertTrue(violations.stream().anyMatch(v -> v.contains("12 caractères")));
    }

    @Test
    void check_shouldRejectNoUppercase() {
        List<String> violations = policyService.check("monmotdepasse1!");

        assertTrue(violations.stream().anyMatch(v -> v.contains("majuscule")));
    }

    @Test
    void check_shouldRejectNoLowercase() {
        List<String> violations = policyService.check("MONMOTDEPASSE1!");

        assertTrue(violations.stream().anyMatch(v -> v.contains("minuscule")));
    }

    @Test
    void check_shouldRejectNoDigit() {
        List<String> violations = policyService.check("MonMotDePasse!!");

        assertTrue(violations.stream().anyMatch(v -> v.contains("chiffre")));
    }

    @Test
    void check_shouldRejectNoSpecialChar() {
        List<String> violations = policyService.check("MonMotDePasse12");

        assertTrue(violations.stream().anyMatch(v -> v.contains("spécial")));
    }

    @Test
    void check_shouldRejectNull() {
        List<String> violations = policyService.check(null);

        assertFalse(violations.isEmpty());
        assertTrue(violations.stream().anyMatch(v -> v.contains("12 caractères")));
    }

    @Test
    void validate_shouldThrowWithMultipleViolations() {
        PasswordPolicyViolationException ex = assertThrows(
                PasswordPolicyViolationException.class,
                () -> policyService.validate("abc"));

        assertTrue(ex.getViolations().size() >= 3);
        assertTrue(ex.getMessage().contains("Politique de mot de passe"));
    }

    @Test
    void validate_shouldThrowOnShortPassword() {
        assertThrows(PasswordPolicyViolationException.class,
                () -> policyService.validate("Short1!"));
    }

    @Test
    void check_shouldReturnEmptyForValidPassword() {
        List<String> violations = policyService.check("MonMotDePasse1!");

        // May contain HIBP violation if password is compromised, but local rules should pass
        assertTrue(violations.stream().noneMatch(v -> v.contains("caractères") ||
                v.contains("majuscule") || v.contains("minuscule") ||
                v.contains("chiffre") || v.contains("spécial")));
    }
}
