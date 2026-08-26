package com.moov.pim.shared.api;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.security.authentication.LockedException;
import org.springframework.security.authorization.AuthorizationDeniedException;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.web.HttpRequestMethodNotSupportedException;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.MissingServletRequestParameterException;
import org.springframework.web.method.annotation.MethodArgumentTypeMismatchException;
import com.moov.pim.permissions.service.AuthService;
import com.moov.pim.rules.service.RuleViolationException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import java.util.Map;
import java.util.LinkedHashMap;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.multipart.MaxUploadSizeExceededException;
import org.springframework.web.servlet.resource.NoResourceFoundException;

import java.util.stream.Collectors;

@RestControllerAdvice
public class GlobalExceptionHandler {

    private static final Logger log = LoggerFactory.getLogger(GlobalExceptionHandler.class);

    @ExceptionHandler(IllegalArgumentException.class)
    public ResponseEntity<ApiError> handleIllegalArgument(IllegalArgumentException ex) {
        return ResponseEntity.badRequest().body(ApiError.of(400, ex.getMessage()));
    }

    /**
     * Composition d'offre refusee par une regle metier bloquante.
     *
     * Renvoyee en 400 avec la liste complete des violations, et non un message
     * unique : l'ecran doit pouvoir nommer chaque regle en cause. Un refus qui se
     * contente de dire « composition invalide » laisse le chef de produit chercher
     * lui-meme laquelle de ses briques pose probleme.
     */
    @ExceptionHandler(RuleViolationException.class)
    public ResponseEntity<Map<String, Object>> handleRuleViolation(RuleViolationException ex) {
        log.info("Composition refusee : {} regle(s) bloquante(s) violee(s)", ex.getViolations().size());
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("status", 400);
        body.put("message", ex.getMessage());
        body.put("code", "RULE_VIOLATION");
        body.put("violations", ex.getViolations());
        return ResponseEntity.badRequest().body(body);
    }

    @ExceptionHandler(IllegalStateException.class)
    public ResponseEntity<ApiError> handleIllegalState(IllegalStateException ex) {
        return ResponseEntity.status(HttpStatus.CONFLICT).body(ApiError.of(409, ex.getMessage()));
    }

    @ExceptionHandler(BadCredentialsException.class)
    public ResponseEntity<ApiError> handleBadCredentials(BadCredentialsException ex) {
        return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(ApiError.of(401, "Email ou mot de passe incorrect"));
    }

    @ExceptionHandler(LockedException.class)
    public ResponseEntity<ApiError> handleLocked(LockedException ex) {
        return ResponseEntity.status(HttpStatus.FORBIDDEN).body(ApiError.of(403, "Compte verrouillé"));
    }

    @ExceptionHandler(AuthService.InvalidMfaCodeException.class)
    public ResponseEntity<ApiError> handleInvalidMfaCode(AuthService.InvalidMfaCodeException ex) {
        return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(ApiError.of(401, "MFA_INVALID"));
    }

    @ExceptionHandler(AuthService.MfaRequiredException.class)
    public ResponseEntity<ApiError> handleMfaRequired(AuthService.MfaRequiredException ex) {
        return ResponseEntity.status(HttpStatus.FORBIDDEN).body(ApiError.of(403, "MFA_REQUIRED"));
    }

    @ExceptionHandler(AuthorizationDeniedException.class)
    public ResponseEntity<ApiError> handleAccessDenied(AuthorizationDeniedException ex) {
        return ResponseEntity.status(HttpStatus.FORBIDDEN).body(ApiError.of(403, "Accès refusé"));
    }

    /**
     * Refus prononce par le code metier et non par une annotation @PreAuthorize :
     * controle de perimetre d'une fiche (checkOwnership) dans OfferService,
     * CatalogService et CampaignService.
     *
     * Seul AuthorizationDeniedException etait traite. AccessDeniedException, dont il
     * herite, retombait donc sur le gestionnaire generique : un chef de produit qui
     * ouvrait la fiche d'un autre recevait un 500 « Erreur interne du serveur » au
     * lieu d'un refus explicite, et l'interface affichait une panne la ou il n'y
     * avait qu'une regle de visibilite. Le message du service est repris tel quel :
     * il dit precisement ce qui est refuse.
     */
    @ExceptionHandler(AccessDeniedException.class)
    public ResponseEntity<ApiError> handleScopeDenied(AccessDeniedException ex) {
        String message = ex.getMessage() != null && !ex.getMessage().isBlank()
                ? ex.getMessage()
                : "Accès refusé";
        return ResponseEntity.status(HttpStatus.FORBIDDEN).body(ApiError.of(403, message));
    }

    @ExceptionHandler(MethodArgumentNotValidException.class)
    public ResponseEntity<ApiError> handleValidation(MethodArgumentNotValidException ex) {
        String errors = ex.getBindingResult().getFieldErrors().stream()
                .map(e -> e.getField() + " : " + e.getDefaultMessage())
                .collect(Collectors.joining(", "));
        return ResponseEntity.badRequest().body(ApiError.of(400, errors));
    }

    @ExceptionHandler(HttpMessageNotReadableException.class)
    public ResponseEntity<ApiError> handleUnreadable(HttpMessageNotReadableException ex) {
        return ResponseEntity.badRequest().body(ApiError.of(400, "Corps de requête invalide ou manquant"));
    }

    @ExceptionHandler(MissingServletRequestParameterException.class)
    public ResponseEntity<ApiError> handleMissingParam(MissingServletRequestParameterException ex) {
        return ResponseEntity.badRequest().body(ApiError.of(400, "Paramètre manquant : " + ex.getParameterName()));
    }

    @ExceptionHandler(MaxUploadSizeExceededException.class)
    public ResponseEntity<ApiError> handleMaxUpload(MaxUploadSizeExceededException ex) {
        return ResponseEntity.status(HttpStatus.PAYLOAD_TOO_LARGE)
                .body(ApiError.of(413, "Fichier trop volumineux (max 50 Mo)"));
    }

    @ExceptionHandler(HttpRequestMethodNotSupportedException.class)
    public ResponseEntity<ApiError> handleMethodNotAllowed(HttpRequestMethodNotSupportedException ex) {
        return ResponseEntity.status(HttpStatus.METHOD_NOT_ALLOWED)
                .body(ApiError.of(405, "Méthode HTTP non supportée : " + ex.getMethod()));
    }

    @ExceptionHandler(NoResourceFoundException.class)
    public ResponseEntity<ApiError> handleNotFound(NoResourceFoundException ex) {
        return ResponseEntity.status(HttpStatus.NOT_FOUND).body(ApiError.of(404, "Ressource introuvable"));
    }

    /**
     * Conflit d'integrite en base : doublon sur une contrainte unique, ou suppression
     * d'un element encore reference. Ce sont des situations provoquees par l'utilisateur,
     * pas des pannes : elles doivent remonter en 409 avec un message exploitable et non
     * en 500 "Erreur interne du serveur".
     */
    @ExceptionHandler(DataIntegrityViolationException.class)
    public ResponseEntity<ApiError> handleDataIntegrity(DataIntegrityViolationException ex) {
        String cause = rootMessage(ex);
        String message;
        if (cause.contains("foreign key") || cause.contains("cl\u00e9 \u00e9trang\u00e8re")) {
            message = "Suppression impossible : cet \u00e9l\u00e9ment est encore r\u00e9f\u00e9renc\u00e9 par d'autres donn\u00e9es";
        } else if (cause.contains("duplicate key") || cause.contains("cl\u00e9 dupliqu\u00e9e")) {
            message = "Un \u00e9l\u00e9ment portant les m\u00eames valeurs existe d\u00e9j\u00e0";
        } else if (cause.contains("not-null") || cause.contains("non nulle")) {
            message = "Un champ obligatoire est absent";
        } else {
            message = "Op\u00e9ration refus\u00e9e : elle romprait la coh\u00e9rence des donn\u00e9es";
        }
        log.warn("Conflit d'integrite : {}", cause);
        return ResponseEntity.status(HttpStatus.CONFLICT).body(ApiError.of(409, message));
    }

    /** Remonte la chaine des causes pour atteindre le message du pilote JDBC. */
    private static String rootMessage(Throwable ex) {
        Throwable current = ex;
        while (current.getCause() != null && current.getCause() != current) {
            current = current.getCause();
        }
        return current.getMessage() == null ? "" : current.getMessage().toLowerCase();
    }

    /**
     * Identifiant ou parametre d'URL au mauvais format (UUID invalide, valeur d'enum
     * inconnue). C'est une requete mal formee et non une panne : sans ce traitement
     * l'appel retombait sur le gestionnaire generique et repondait 500.
     */
    @ExceptionHandler(MethodArgumentTypeMismatchException.class)
    public ResponseEntity<ApiError> handleTypeMismatch(MethodArgumentTypeMismatchException ex) {
        Class<?> expected = ex.getRequiredType();
        String detail = expected != null && expected.isEnum()
                ? "valeur attendue : " + String.join(", ", enumNames(expected))
                : "format attendu : " + (expected == null ? "inconnu" : expected.getSimpleName());
        return ResponseEntity.badRequest()
                .body(ApiError.of(400, "Param\u00e8tre invalide : " + ex.getName() + " (" + detail + ")"));
    }

    private static String[] enumNames(Class<?> type) {
        Object[] constants = type.getEnumConstants();
        String[] names = new String[constants.length];
        for (int i = 0; i < constants.length; i++) {
            names[i] = ((Enum<?>) constants[i]).name();
        }
        return names;
    }

    @ExceptionHandler(Exception.class)
    public ResponseEntity<ApiError> handleAll(Exception ex) {
        log.error("Erreur interne non gérée", ex);
        return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                .body(ApiError.of(500, "Erreur interne du serveur"));
    }
}
