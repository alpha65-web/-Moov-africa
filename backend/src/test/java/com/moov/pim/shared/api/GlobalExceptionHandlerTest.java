package com.moov.pim.shared.api;

import com.moov.pim.permissions.service.AuthService;
import org.junit.jupiter.api.Test;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.HttpStatus;
import org.springframework.core.MethodParameter;
import org.springframework.web.method.annotation.MethodArgumentTypeMismatchException;
import java.util.UUID;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.security.authentication.LockedException;
import org.springframework.security.authorization.AuthorizationDeniedException;
import org.springframework.web.HttpRequestMethodNotSupportedException;
import org.springframework.web.multipart.MaxUploadSizeExceededException;
import org.springframework.web.servlet.resource.NoResourceFoundException;

import static org.junit.jupiter.api.Assertions.*;

class GlobalExceptionHandlerTest {

    private final GlobalExceptionHandler handler = new GlobalExceptionHandler();

    @Test
    void handleDataIntegrity_foreignKey_shouldReturn409WithDeletionMessage() {
        var ex = new DataIntegrityViolationException("wrapper",
                new RuntimeException("update or delete on table \"offers\" violates foreign key constraint"));

        var result = handler.handleDataIntegrity(ex);

        assertEquals(HttpStatus.CONFLICT, result.getStatusCode());
        assertTrue(result.getBody().message().contains("Suppression impossible"));
    }

    @Test
    void handleDataIntegrity_duplicateKey_shouldReturn409WithDuplicateMessage() {
        var ex = new DataIntegrityViolationException("wrapper",
                new RuntimeException("duplicate key value violates unique constraint"));

        var result = handler.handleDataIntegrity(ex);

        assertEquals(HttpStatus.CONFLICT, result.getStatusCode());
        assertTrue(result.getBody().message().contains("existe"));
    }

    @Test
    void handleDataIntegrity_unknownCause_shouldStillReturn409() {
        var ex = new DataIntegrityViolationException("cause inconnue");

        var result = handler.handleDataIntegrity(ex);

        assertEquals(HttpStatus.CONFLICT, result.getStatusCode());
        assertEquals(409, result.getBody().status());
    }

    @Test
    void handleTypeMismatch_invalidUuid_shouldReturn400() {
        var ex = new MethodArgumentTypeMismatchException(
                "pas-un-uuid", UUID.class, "id", (MethodParameter) null, null);

        var result = handler.handleTypeMismatch(ex);

        assertEquals(HttpStatus.BAD_REQUEST, result.getStatusCode());
        assertTrue(result.getBody().message().contains("id"));
        assertTrue(result.getBody().message().contains("UUID"));
    }

    @Test
    void handleTypeMismatch_invalidEnum_shouldListAcceptedValues() {
        var ex = new MethodArgumentTypeMismatchException(
                "INCONNU", HttpStatus.class, "status", (MethodParameter) null, null);

        var result = handler.handleTypeMismatch(ex);

        assertEquals(HttpStatus.BAD_REQUEST, result.getStatusCode());
        assertTrue(result.getBody().message().contains("valeur attendue"));
    }

    @Test
    void handleInvalidMfaCode_shouldReturn401WithDedicatedMessage() {
        var result = handler.handleInvalidMfaCode(new AuthService.InvalidMfaCodeException());

        assertEquals(HttpStatus.UNAUTHORIZED, result.getStatusCode());
        assertEquals("MFA_INVALID", result.getBody().message());
    }

    @Test
    void handleIllegalArgument_shouldReturn400() {
        var result = handler.handleIllegalArgument(new IllegalArgumentException("champ invalide"));

        assertEquals(HttpStatus.BAD_REQUEST, result.getStatusCode());
        assertEquals(400, result.getBody().status());
        assertEquals("champ invalide", result.getBody().message());
    }

    @Test
    void handleIllegalState_shouldReturn409() {
        var result = handler.handleIllegalState(new IllegalStateException("conflit"));

        assertEquals(HttpStatus.CONFLICT, result.getStatusCode());
        assertEquals(409, result.getBody().status());
    }

    @Test
    void handleBadCredentials_shouldReturn401() {
        var result = handler.handleBadCredentials(new BadCredentialsException("bad"));

        assertEquals(HttpStatus.UNAUTHORIZED, result.getStatusCode());
        assertEquals(401, result.getBody().status());
        assertTrue(result.getBody().message().contains("incorrect"));
    }

    @Test
    void handleLocked_shouldReturn403() {
        var result = handler.handleLocked(new LockedException("locked"));

        assertEquals(HttpStatus.FORBIDDEN, result.getStatusCode());
        assertTrue(result.getBody().message().contains("verrouillé"));
    }

    @Test
    void handleMfaRequired_shouldReturn403() {
        var result = handler.handleMfaRequired(new AuthService.MfaRequiredException());

        assertEquals(HttpStatus.FORBIDDEN, result.getStatusCode());
        assertEquals("MFA_REQUIRED", result.getBody().message());
    }

    @Test
    void handleAccessDenied_shouldReturn403() {
        var result = handler.handleAccessDenied(
                new AuthorizationDeniedException("denied"));

        assertEquals(HttpStatus.FORBIDDEN, result.getStatusCode());
        assertTrue(result.getBody().message().contains("refusé"));
    }

    @Test
    void handleUnreadable_shouldReturn400() {
        var result = handler.handleUnreadable(
                new HttpMessageNotReadableException("bad body"));

        assertEquals(HttpStatus.BAD_REQUEST, result.getStatusCode());
        assertTrue(result.getBody().message().contains("invalide"));
    }

    @Test
    void handleMaxUpload_shouldReturn413() {
        var result = handler.handleMaxUpload(
                new MaxUploadSizeExceededException(50_000_000));

        assertEquals(HttpStatus.PAYLOAD_TOO_LARGE, result.getStatusCode());
        assertEquals(413, result.getBody().status());
    }

    @Test
    void handleMethodNotAllowed_shouldReturn405() {
        var result = handler.handleMethodNotAllowed(
                new HttpRequestMethodNotSupportedException("PATCH"));

        assertEquals(HttpStatus.METHOD_NOT_ALLOWED, result.getStatusCode());
        assertTrue(result.getBody().message().contains("PATCH"));
    }

    @Test
    void handleNotFound_shouldReturn404() throws Exception {
        var result = handler.handleNotFound(
                new NoResourceFoundException(org.springframework.http.HttpMethod.GET, "/unknown"));

        assertEquals(HttpStatus.NOT_FOUND, result.getStatusCode());
        assertTrue(result.getBody().message().contains("introuvable"));
    }

    @Test
    void handleAll_shouldReturn500() {
        var result = handler.handleAll(new RuntimeException("boom"));

        assertEquals(HttpStatus.INTERNAL_SERVER_ERROR, result.getStatusCode());
        assertEquals(500, result.getBody().status());
        assertTrue(result.getBody().message().contains("interne"));
    }

    @Test
    void apiError_shouldHaveTimestamp() {
        var result = handler.handleIllegalArgument(new IllegalArgumentException("test"));

        assertNotNull(result.getBody().timestamp());
    }
}
