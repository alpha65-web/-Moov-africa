package com.moov.pim.permissions.api;

import com.moov.pim.permissions.api.dto.LoginResponse;
import com.moov.pim.permissions.security.CustomUserDetails;
import com.moov.pim.permissions.service.WebAuthnService;
import jakarta.servlet.http.Cookie;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;

@RestController
@RequestMapping("/auth/webauthn")
@ConditionalOnProperty(name = "pim.webauthn.enabled", havingValue = "true")
public class WebAuthnController {

    private final WebAuthnService webAuthnService;

    public WebAuthnController(WebAuthnService webAuthnService) {
        this.webAuthnService = webAuthnService;
    }

    @PostMapping(value = "/register/options", produces = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<String> registrationOptions(
            @AuthenticationPrincipal CustomUserDetails principal) {
        String options = webAuthnService.startRegistration(principal.getUserId());
        return ResponseEntity.ok(options);
    }

    @PostMapping("/register/verify")
    public ResponseEntity<Void> verifyRegistration(
            @RequestBody Map<String, String> body) {
        webAuthnService.finishRegistration(
                body.get("requestId"),
                body.get("credential"),
                body.get("name"));
        return ResponseEntity.ok().build();
    }

    @PostMapping(value = "/login/options", produces = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<String> assertionOptions(
            @RequestBody(required = false) Map<String, String> body) {
        String email = body != null ? body.get("email") : null;
        String options = webAuthnService.startAssertion(email);
        return ResponseEntity.ok(options);
    }

    @PostMapping("/login/verify")
    public ResponseEntity<LoginResponse> verifyAssertion(
            @RequestBody Map<String, String> body,
            HttpServletResponse httpResponse) {
        LoginResponse loginResponse = webAuthnService.finishAssertion(
                body.get("requestId"),
                body.get("credential"));
        setFingerprintCookie(httpResponse, loginResponse.fingerprint());
        return ResponseEntity.ok(loginResponse);
    }

    private void setFingerprintCookie(HttpServletResponse response, String fingerprint) {
        if (fingerprint == null) return;
        Cookie cookie = new Cookie("__Secure-Fgp", fingerprint);
        cookie.setHttpOnly(true);
        cookie.setSecure(true);
        cookie.setPath("/");
        cookie.setMaxAge(7 * 24 * 60 * 60);
        cookie.setAttribute("SameSite", "Strict");
        response.addCookie(cookie);
    }
}
