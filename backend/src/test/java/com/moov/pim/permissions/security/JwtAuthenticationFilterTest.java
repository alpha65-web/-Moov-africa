package com.moov.pim.permissions.security;

import com.moov.pim.permissions.domain.Role;
import com.moov.pim.permissions.domain.RoleName;
import com.moov.pim.permissions.domain.User;
import jakarta.servlet.FilterChain;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.core.context.SecurityContextHolder;

import java.io.PrintWriter;
import java.io.StringWriter;
import java.lang.reflect.Field;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class JwtAuthenticationFilterTest {

    @Mock private JwtTokenProvider jwtTokenProvider;
    @Mock private CustomUserDetailsService userDetailsService;
    @InjectMocks private JwtAuthenticationFilter filter;

    @AfterEach
    void tearDown() {
        SecurityContextHolder.clearContext();
    }

    @Test
    void doFilter_shouldContinueWithoutToken() throws Exception {
        var request = mock(HttpServletRequest.class);
        var response = mock(HttpServletResponse.class);
        var chain = mock(FilterChain.class);
        when(request.getHeader("Authorization")).thenReturn(null);

        filter.doFilterInternal(request, response, chain);

        verify(chain).doFilter(request, response);
        assertNull(SecurityContextHolder.getContext().getAuthentication());
    }

    @Test
    void doFilter_shouldReject401IfInvalidTokenType() throws Exception {
        var request = mock(HttpServletRequest.class);
        var response = mock(HttpServletResponse.class);
        var chain = mock(FilterChain.class);
        var writer = new StringWriter();
        when(request.getHeader("Authorization")).thenReturn("Bearer my.jwt.token");
        when(jwtTokenProvider.validateToken("my.jwt.token")).thenReturn(true);
        when(jwtTokenProvider.getTokenType("my.jwt.token")).thenReturn("refresh");
        when(response.getWriter()).thenReturn(new PrintWriter(writer));

        filter.doFilterInternal(request, response, chain);

        verify(response).setStatus(401);
        verify(chain, never()).doFilter(request, response);
        assertTrue(writer.toString().contains("Token de type invalide"));
    }

    @Test
    void doFilter_shouldReject401IfTokenVersionMismatch() throws Exception {
        var request = mock(HttpServletRequest.class);
        var response = mock(HttpServletResponse.class);
        var chain = mock(FilterChain.class);
        var writer = new StringWriter();
        when(request.getHeader("Authorization")).thenReturn("Bearer valid.jwt.token");
        when(jwtTokenProvider.validateToken("valid.jwt.token")).thenReturn(true);
        when(jwtTokenProvider.getTokenType("valid.jwt.token")).thenReturn("access");
        when(jwtTokenProvider.getFingerprintHashFromToken("valid.jwt.token")).thenReturn(null);
        when(jwtTokenProvider.getEmailFromToken("valid.jwt.token")).thenReturn("chef@moov.bf");
        when(jwtTokenProvider.getTokenVersionFromToken("valid.jwt.token")).thenReturn(5);

        Role role = createRole(RoleName.CHEF_PRODUIT);
        User user = new User("chef@moov.bf", "$2a$hash", "Chef", "Produit", role);
        setField(User.class, user, "id", UUID.randomUUID());
        var userDetails = new CustomUserDetails(user);
        when(userDetailsService.loadUserByUsername("chef@moov.bf")).thenReturn(userDetails);
        when(response.getWriter()).thenReturn(new PrintWriter(writer));

        filter.doFilterInternal(request, response, chain);

        verify(response).setStatus(401);
        assertTrue(writer.toString().contains("révoqué"));
    }

    @Test
    void doFilter_shouldAuthenticateValidToken() throws Exception {
        var request = mock(HttpServletRequest.class);
        var response = mock(HttpServletResponse.class);
        var chain = mock(FilterChain.class);
        when(request.getHeader("Authorization")).thenReturn("Bearer valid.jwt.token");
        when(jwtTokenProvider.validateToken("valid.jwt.token")).thenReturn(true);
        when(jwtTokenProvider.getTokenType("valid.jwt.token")).thenReturn("access");
        when(jwtTokenProvider.getFingerprintHashFromToken("valid.jwt.token")).thenReturn(null);
        when(jwtTokenProvider.getEmailFromToken("valid.jwt.token")).thenReturn("chef@moov.bf");
        when(jwtTokenProvider.getTokenVersionFromToken("valid.jwt.token")).thenReturn(0);

        Role role = createRole(RoleName.CHEF_PRODUIT);
        User user = new User("chef@moov.bf", "$2a$hash", "Chef", "Produit", role);
        setField(User.class, user, "id", UUID.randomUUID());
        var userDetails = new CustomUserDetails(user);
        when(userDetailsService.loadUserByUsername("chef@moov.bf")).thenReturn(userDetails);

        filter.doFilterInternal(request, response, chain);

        verify(chain).doFilter(request, response);
        assertNotNull(SecurityContextHolder.getContext().getAuthentication());
        assertEquals("chef@moov.bf",
                SecurityContextHolder.getContext().getAuthentication().getName());
    }

    @Test
    void doFilter_shouldContinueIfTokenInvalid() throws Exception {
        var request = mock(HttpServletRequest.class);
        var response = mock(HttpServletResponse.class);
        var chain = mock(FilterChain.class);
        when(request.getHeader("Authorization")).thenReturn("Bearer bad.token");
        when(jwtTokenProvider.validateToken("bad.token")).thenReturn(false);

        filter.doFilterInternal(request, response, chain);

        verify(chain).doFilter(request, response);
        assertNull(SecurityContextHolder.getContext().getAuthentication());
    }

    @Test
    void doFilter_shouldReject403IfForcePasswordChange() throws Exception {
        var request = mock(HttpServletRequest.class);
        var response = mock(HttpServletResponse.class);
        var chain = mock(FilterChain.class);
        var writer = new StringWriter();
        when(request.getHeader("Authorization")).thenReturn("Bearer valid.jwt.token");
        when(request.getServletPath()).thenReturn("/offers");
        when(jwtTokenProvider.validateToken("valid.jwt.token")).thenReturn(true);
        when(jwtTokenProvider.getTokenType("valid.jwt.token")).thenReturn("access");
        when(jwtTokenProvider.getFingerprintHashFromToken("valid.jwt.token")).thenReturn(null);
        when(jwtTokenProvider.getEmailFromToken("valid.jwt.token")).thenReturn("user@moov.bf");
        when(jwtTokenProvider.getTokenVersionFromToken("valid.jwt.token")).thenReturn(0);

        Role role = createRole(RoleName.CHEF_PRODUIT);
        User user = new User("user@moov.bf", "$2a$hash", "U", "Ser", role);
        setField(User.class, user, "id", UUID.randomUUID());
        user.setForcePasswordChange(true);
        var userDetails = new CustomUserDetails(user);
        when(userDetailsService.loadUserByUsername("user@moov.bf")).thenReturn(userDetails);
        when(response.getWriter()).thenReturn(new PrintWriter(writer));

        filter.doFilterInternal(request, response, chain);

        verify(response).setStatus(403);
        assertTrue(writer.toString().contains("FORCE_PASSWORD_CHANGE"));
    }

    private static void setField(Class<?> clazz, Object target, String fieldName, Object value) {
        try {
            Field field = clazz.getDeclaredField(fieldName);
            field.setAccessible(true);
            field.set(target, value);
        } catch (Exception e) {
            throw new RuntimeException(e);
        }
    }

    private static Role createRole(RoleName roleName) {
        try {
            var constructor = Role.class.getDeclaredConstructor();
            constructor.setAccessible(true);
            Role role = constructor.newInstance();
            setField(Role.class, role, "name", roleName);
            setField(Role.class, role, "id", UUID.randomUUID());
            return role;
        } catch (Exception e) {
            throw new RuntimeException(e);
        }
    }
}
