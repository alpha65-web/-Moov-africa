package com.moov.pim.permissions.security;

import com.moov.pim.permissions.domain.Role;
import com.moov.pim.permissions.domain.RoleName;
import com.moov.pim.permissions.domain.User;
import jakarta.servlet.FilterChain;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;

import java.io.PrintWriter;
import java.io.StringWriter;
import java.lang.reflect.Field;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

class MfaPolicyFilterTest {

    private final MfaPolicyFilter filter = new MfaPolicyFilter();

    @AfterEach
    void tearDown() {
        SecurityContextHolder.clearContext();
    }

    @Test
    void doFilter_shouldPassIfNotAuthenticated() throws Exception {
        var request = mock(HttpServletRequest.class);
        var response = mock(HttpServletResponse.class);
        var chain = mock(FilterChain.class);

        filter.doFilterInternal(request, response, chain);

        verify(chain).doFilter(request, response);
    }

    @Test
    void doFilter_shouldPassIfNonAdminWithoutMfa() throws Exception {
        setupAuth(RoleName.CHEF_PRODUIT, false);
        var request = mock(HttpServletRequest.class);
        var response = mock(HttpServletResponse.class);
        var chain = mock(FilterChain.class);

        filter.doFilterInternal(request, response, chain);

        verify(chain).doFilter(request, response);
    }

    @Test
    void doFilter_shouldPassIfAdminWithMfa() throws Exception {
        setupAuth(RoleName.ADMIN_SYSTEME, true);
        var request = mock(HttpServletRequest.class);
        var response = mock(HttpServletResponse.class);
        var chain = mock(FilterChain.class);

        filter.doFilterInternal(request, response, chain);

        verify(chain).doFilter(request, response);
    }

    @Test
    void doFilter_shouldBlock403IfAdminWithoutMfa() throws Exception {
        setupAuth(RoleName.ADMIN_SYSTEME, false);
        var request = mock(HttpServletRequest.class);
        var response = mock(HttpServletResponse.class);
        var chain = mock(FilterChain.class);
        var writer = new StringWriter();
        when(request.getServletPath()).thenReturn("/users");
        when(response.getWriter()).thenReturn(new PrintWriter(writer));

        filter.doFilterInternal(request, response, chain);

        verify(response).setStatus(403);
        verify(chain, never()).doFilter(request, response);
        assertTrue(writer.toString().contains("MFA_REQUIRED_FOR_ADMIN"));
    }

    @Test
    void doFilter_shouldAllowExemptPathForAdminWithoutMfa() throws Exception {
        setupAuth(RoleName.ADMIN_SYSTEME, false);
        var request = mock(HttpServletRequest.class);
        var response = mock(HttpServletResponse.class);
        var chain = mock(FilterChain.class);
        when(request.getServletPath()).thenReturn("/auth/totp/setup");

        filter.doFilterInternal(request, response, chain);

        verify(chain).doFilter(request, response);
    }

    private void setupAuth(RoleName roleName, boolean totpEnabled) throws Exception {
        Role role = createRole(roleName);
        User user = new User("user@moov.bf", "$2a$hash", "U", "Ser", role);
        setField(User.class, user, "id", UUID.randomUUID());
        user.setTotpEnabled(totpEnabled);
        var details = new CustomUserDetails(user);
        SecurityContextHolder.getContext().setAuthentication(
                new UsernamePasswordAuthenticationToken(details, null, details.getAuthorities()));
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
