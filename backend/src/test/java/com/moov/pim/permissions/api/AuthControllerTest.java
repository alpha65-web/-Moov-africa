package com.moov.pim.permissions.api;

import com.moov.pim.permissions.api.dto.LoginRequest;
import com.moov.pim.permissions.api.dto.LoginResponse;
import com.moov.pim.permissions.api.dto.RefreshTokenRequest;
import com.moov.pim.permissions.api.dto.RegisterRequest;
import com.moov.pim.permissions.api.dto.TotpSetupResponse;
import com.moov.pim.permissions.api.dto.TotpVerifyRequest;
import com.moov.pim.permissions.api.dto.UserResponse;
import com.moov.pim.permissions.security.CustomUserDetails;
import com.moov.pim.permissions.service.AuthService;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.HttpStatus;

import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class AuthControllerTest {

    @Mock private AuthService authService;
    @InjectMocks private AuthController controller;

    @Test
    void login_shouldReturn200() {
        var request = mock(LoginRequest.class);
        var httpRequest = mock(HttpServletRequest.class);
        var httpResponse = mock(HttpServletResponse.class);
        when(httpRequest.getHeader("X-Forwarded-For")).thenReturn(null);
        when(httpRequest.getRemoteAddr()).thenReturn("192.168.1.1");
        when(httpRequest.getHeader("User-Agent")).thenReturn("Mozilla/5.0");

        var loginResponse = mock(LoginResponse.class);
        when(loginResponse.fingerprint()).thenReturn("fp123");
        when(authService.login(request, "192.168.1.1", "Mozilla/5.0")).thenReturn(loginResponse);

        var result = controller.login(request, httpRequest, httpResponse);

        assertEquals(HttpStatus.OK, result.getStatusCode());
        assertEquals(loginResponse, result.getBody());
        verify(httpResponse).addCookie(any());
    }

    @Test
    void login_shouldExtractIpFromXForwardedFor() {
        var request = mock(LoginRequest.class);
        var httpRequest = mock(HttpServletRequest.class);
        var httpResponse = mock(HttpServletResponse.class);
        when(httpRequest.getHeader("X-Forwarded-For")).thenReturn("10.0.0.1, 172.16.0.1");
        when(httpRequest.getHeader("User-Agent")).thenReturn(null);

        var loginResponse = mock(LoginResponse.class);
        when(authService.login(request, "10.0.0.1", null)).thenReturn(loginResponse);

        controller.login(request, httpRequest, httpResponse);

        verify(authService).login(request, "10.0.0.1", null);
    }

    @Test
    void register_shouldReturn201() {
        var request = mock(RegisterRequest.class);
        var response = mock(UserResponse.class);
        when(authService.register(request)).thenReturn(response);

        var result = controller.register(request);

        assertEquals(HttpStatus.CREATED, result.getStatusCode());
        assertEquals(response, result.getBody());
    }

    @Test
    void logout_shouldReturn204() {
        UUID userId = UUID.randomUUID();
        var principal = mock(CustomUserDetails.class);
        when(principal.getUserId()).thenReturn(userId);

        var result = controller.logout(principal, null);

        assertEquals(HttpStatus.NO_CONTENT, result.getStatusCode());
        verify(authService).logout(userId, null);
    }

    @Test
    void setupTotp_shouldReturn200() {
        UUID userId = UUID.randomUUID();
        var principal = mock(CustomUserDetails.class);
        when(principal.getUserId()).thenReturn(userId);
        var totpResponse = mock(TotpSetupResponse.class);
        when(authService.setupTotp(userId)).thenReturn(totpResponse);

        var result = controller.setupTotp(principal);

        assertEquals(HttpStatus.OK, result.getStatusCode());
        assertEquals(totpResponse, result.getBody());
    }

    @Test
    void enableTotp_shouldReturn200() {
        UUID userId = UUID.randomUUID();
        var principal = mock(CustomUserDetails.class);
        when(principal.getUserId()).thenReturn(userId);
        var request = mock(TotpVerifyRequest.class);
        when(request.code()).thenReturn("123456");

        var result = controller.enableTotp(principal, request);

        assertEquals(HttpStatus.OK, result.getStatusCode());
        verify(authService).enableTotp(userId, "123456");
    }
}
