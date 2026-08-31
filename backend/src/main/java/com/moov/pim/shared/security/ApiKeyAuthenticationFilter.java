package com.moov.pim.shared.security;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.util.List;
import java.util.Optional;

/**
 * Authentification des systemes tiers sur le flux de consommation.
 *
 * Le CRM et le centre d'appel n'ont pas de compte utilisateur sur la plateforme :
 * exiger d'eux un jeton d'authentification reviendrait a leur confier les
 * identifiants d'une personne, et a faire expirer leur acces toutes les quelques
 * minutes. Ils presentent donc une cle dediee, revocable, rattachee au canal
 * qu'ils consomment.
 *
 * Le filtre ne s'applique qu'a /feed : partout ailleurs, c'est le jeton de
 * session qui continue de faire foi, et une cle presentee sur un autre chemin
 * n'ouvre rien.
 */
@Component
public class ApiKeyAuthenticationFilter extends OncePerRequestFilter {

    private static final Logger log = LoggerFactory.getLogger(ApiKeyAuthenticationFilter.class);
    private static final String FEED_PREFIX = "/feed";
    private static final String HEADER = "X-Api-Key";

    private final ApiKeyAuthenticator authenticator;

    public ApiKeyAuthenticationFilter(ApiKeyAuthenticator authenticator) {
        this.authenticator = authenticator;
    }

    @Override
    protected boolean shouldNotFilter(HttpServletRequest request) {
        return !request.getServletPath().startsWith(FEED_PREFIX);
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain chain)
            throws ServletException, IOException {

        String presented = request.getHeader(HEADER);
        if (presented == null || presented.isBlank()) {
            reject(response, "Cle de consommation absente : renseignez l'en-tete " + HEADER);
            return;
        }

        Optional<ApiKeyAuthenticator.ApiKeyPrincipal> principal = authenticator.authenticate(presented.trim());
        if (principal.isEmpty()) {
            log.warn("Flux de consommation : cle refusee sur {}", request.getServletPath());
            reject(response, "Cle de consommation invalide ou revoquee");
            return;
        }

        UsernamePasswordAuthenticationToken authentication = new UsernamePasswordAuthenticationToken(
                principal.get(), null, List.of(new SimpleGrantedAuthority("FEED_CONSUME")));
        SecurityContextHolder.getContext().setAuthentication(authentication);

        chain.doFilter(request, response);
    }

    private void reject(HttpServletResponse response, String message) throws IOException {
        response.setStatus(HttpStatus.UNAUTHORIZED.value());
        response.setContentType(MediaType.APPLICATION_JSON_VALUE);
        response.setCharacterEncoding("UTF-8");
        response.getWriter().write("{\"status\":401,\"message\":\"" + message + "\"}");
    }
}
