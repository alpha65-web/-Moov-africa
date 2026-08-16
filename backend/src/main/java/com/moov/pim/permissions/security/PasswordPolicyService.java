package com.moov.pim.permissions.security;

import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.ArrayList;
import java.util.HexFormat;
import java.util.List;

@Service
public class PasswordPolicyService {

    private static final int MIN_LENGTH = 12;
    private static final String HIBP_RANGE_API = "https://api.pwnedpasswords.com/range/";

    public void validate(String password) {
        List<String> violations = check(password);
        if (!violations.isEmpty()) {
            throw new PasswordPolicyViolationException(violations);
        }
    }

    public List<String> check(String password) {
        List<String> violations = new ArrayList<>();
        if (password == null || password.length() < MIN_LENGTH) {
            violations.add("Minimum 12 caractères requis");
            if (password == null) return violations;
        }
        if (!password.matches(".*[A-Z].*")) {
            violations.add("Au moins une majuscule requise");
        }
        if (!password.matches(".*[a-z].*")) {
            violations.add("Au moins une minuscule requise");
        }
        if (!password.matches(".*\\d.*")) {
            violations.add("Au moins un chiffre requis");
        }
        if (!password.matches(".*[!@#$%^&*()_+\\-=\\[\\]{};':\"\\\\|,.<>/?~`].*")) {
            violations.add("Au moins un caractère spécial requis");
        }
        if (isCompromised(password)) {
            violations.add("Mot de passe présent dans une fuite de données connue (Have I Been Pwned)");
        }
        return violations;
    }

    private boolean isCompromised(String password) {
        try {
            byte[] hash = MessageDigest.getInstance("SHA-1")
                    .digest(password.getBytes(StandardCharsets.UTF_8));
            String sha1 = HexFormat.of().formatHex(hash).toUpperCase();
            String prefix = sha1.substring(0, 5);
            String suffix = sha1.substring(5);
            RestTemplate restTemplate = new RestTemplate();
            String body = restTemplate.getForObject(HIBP_RANGE_API + prefix, String.class);
            return body != null && body.contains(suffix);
        } catch (Exception e) {
            return false;
        }
    }

    public static class PasswordPolicyViolationException extends IllegalArgumentException {
        private final List<String> violations;

        public PasswordPolicyViolationException(List<String> violations) {
            super("Politique de mot de passe non respectée : " + String.join(", ", violations));
            this.violations = violations;
        }

        public List<String> getViolations() {
            return violations;
        }
    }
}
