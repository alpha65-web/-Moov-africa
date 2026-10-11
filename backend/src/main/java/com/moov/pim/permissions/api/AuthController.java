package com.moov.pim.permissions.api;

import com.moov.pim.permissions.api.dto.ChangePasswordRequest;
import com.moov.pim.permissions.api.dto.LoginRequest;
import com.moov.pim.permissions.api.dto.LoginResponse;
import com.moov.pim.permissions.api.dto.PasswordResetRequestCreate;
import com.moov.pim.permissions.api.dto.RefreshTokenRequest;
import com.moov.pim.permissions.api.dto.RegisterRequest;
import com.moov.pim.permissions.api.dto.TotpSetupResponse;
import com.moov.pim.permissions.api.dto.TotpVerifyRequest;
import com.moov.pim.permissions.api.dto.UserResponse;
import com.moov.pim.permissions.security.CustomUserDetails;
import com.moov.pim.permissions.service.AuthService;
import com.moov.pim.permissions.service.PasswordResetRequestService;
import jakarta.servlet.http.Cookie;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/auth")
public class AuthController {

    private final AuthService authService;
    private final PasswordResetRequestService passwordResetRequestService;

    public AuthController(AuthService authService,
                          PasswordResetRequestService passwordResetRequestService) {
        this.authService = authService;
        this.passwordResetRequestService = passwordResetRequestService;
    }

    @PostMapping("/login")
    public ResponseEntity<LoginResponse> login(@Valid @RequestBody LoginRequest request,
                                                HttpServletRequest httpRequest,
                                                HttpServletResponse httpResponse) {
        String ip = extractIp(httpRequest);
        String ua = httpRequest.getHeader("User-Agent");
        LoginResponse loginResponse = authService.login(request, ip, ua);
        setFingerprintCookie(httpResponse, loginResponse.fingerprint());
        return ResponseEntity.ok(loginResponse);
    }

    @PostMapping("/register")
    @PreAuthorize("hasAuthority('USER_MANAGE')")
    public ResponseEntity<UserResponse> register(@Valid @RequestBody RegisterRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED).body(authService.register(request));
    }

    @PostMapping("/refresh")
    public ResponseEntity<LoginResponse> refresh(@Valid @RequestBody RefreshTokenRequest request,
                                                  HttpServletResponse httpResponse) {
        LoginResponse loginResponse = authService.refreshToken(request.refreshToken());
        setFingerprintCookie(httpResponse, loginResponse.fingerprint());
        return ResponseEntity.ok(loginResponse);
    }

    @PostMapping("/change-password")
    public ResponseEntity<LoginResponse> changePassword(
            @AuthenticationPrincipal CustomUserDetails principal,
            @Valid @RequestBody ChangePasswordRequest request,
            HttpServletResponse httpResponse) {
        LoginResponse loginResponse = authService.changePassword(principal.getUserId(), request);
        setFingerprintCookie(httpResponse, loginResponse.fingerprint());
        return ResponseEntity.ok(loginResponse);
    }

    @PostMapping("/logout")
    public ResponseEntity<Void> logout(
            @AuthenticationPrincipal CustomUserDetails principal,
            @RequestBody(required = false) RefreshTokenRequest request) {
        String refreshToken = request != null ? request.refreshToken() : null;
        authService.logout(principal.getUserId(), refreshToken);
        return ResponseEntity.noContent().build();
    }

    /**
     * Depot d'une demande de reinitialisation depuis l'ecran de connexion.
     *
     * Point d'entree public : la personne ne peut precisement plus s'authentifier.
     * La reponse est toujours 202, que l'adresse corresponde ou non a un compte,
     * pour que l'ecran de connexion ne renseigne personne sur les comptes
     * existants. Le geste ne change aucun mot de passe : il signale seulement le
     * compte a l'administrateur.
     */
    @PostMapping("/password-reset-requests")
    public ResponseEntity<Void> requestPasswordReset(@Valid @RequestBody PasswordResetRequestCreate request,
                                                      HttpServletRequest httpRequest) {
        passwordResetRequestService.submit(request.email(), extractIp(httpRequest));
        return ResponseEntity.accepted().build();
    }

    @PostMapping("/totp/setup")
    public ResponseEntity<TotpSetupResponse> setupTotp(
            @AuthenticationPrincipal CustomUserDetails principal) {
        return ResponseEntity.ok(authService.setupTotp(principal.getUserId()));
    }

    @PostMapping("/totp/enable")
    public ResponseEntity<Void> enableTotp(
            @AuthenticationPrincipal CustomUserDetails principal,
            @Valid @RequestBody TotpVerifyRequest request) {
        authService.enableTotp(principal.getUserId(), request.code());
        return ResponseEntity.ok().build();
    }

    @DeleteMapping("/totp")
    public ResponseEntity<Void> disableTotp(
            @AuthenticationPrincipal CustomUserDetails principal,
            @Valid @RequestBody TotpVerifyRequest request) {
        authService.disableTotp(principal.getUserId(), request.code());
        return ResponseEntity.noContent().build();
    }

    private String extractIp(HttpServletRequest request) {
        String xff = request.getHeader("X-Forwarded-For");
        if (xff != null && !xff.isBlank()) {
            return xff.split(",")[0].trim();
        }
        return request.getRemoteAddr();
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
