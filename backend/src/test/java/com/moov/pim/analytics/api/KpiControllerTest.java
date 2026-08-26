package com.moov.pim.analytics.api;

import com.moov.pim.analytics.service.KpiService;
import com.moov.pim.analytics.service.KpiSummaryService;
import com.moov.pim.permissions.domain.Permission;
import com.moov.pim.permissions.domain.Role;
import com.moov.pim.permissions.domain.RoleName;
import com.moov.pim.permissions.domain.User;
import com.moov.pim.permissions.security.CustomUserDetails;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.PageRequest;
import org.springframework.http.HttpStatus;

import java.lang.reflect.Field;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Set;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class KpiControllerTest {

    @Mock private KpiService kpiService;
    @Mock private KpiSummaryService kpiSummaryService;
    @InjectMocks private KpiController controller;

    @Test
    void byOffer_shouldReturn200() {
        UUID offerId = UUID.randomUUID();
        var pageable = PageRequest.of(0, 10);
        when(kpiService.getByOffer(offerId, pageable)).thenReturn(new PageImpl<>(List.of()));

        var result = controller.byOffer(offerId, pageable);

        assertEquals(HttpStatus.OK, result.getStatusCode());
    }

    /**
     * Le detenteur de la vue transversale recoit l'activite de toute l'equipe.
     */
    @Test
    void byPeriod_shouldUseTeamScopeWhenTeamViewIsGranted() {
        var from = LocalDateTime.of(2026, 1, 1, 0, 0);
        var to = LocalDateTime.of(2026, 12, 31, 23, 59);
        var pageable = PageRequest.of(0, 10);
        CustomUserDetails principal = principalWith(RoleName.CHEF_DEPARTEMENT,
                "ANALYTICS_VIEW", "ANALYTICS_TEAM_VIEW");

        when(kpiService.getByPeriod(eq(from), eq(to), eq(true), any(), eq(pageable)))
                .thenReturn(new PageImpl<>(List.of()));

        var result = controller.byPeriod(from, to, principal, pageable);

        assertEquals(HttpStatus.OK, result.getStatusCode());
        verify(kpiService).getByPeriod(from, to, true, principal.getUserId(), pageable);
    }

    /**
     * Sans ANALYTICS_TEAM_VIEW, le flux se limite aux evenements dont le demandeur
     * est l'auteur. C'est le cas de l'analyste marketing : le cahier des charges
     * (section 7.9) ne lui ouvre que son propre temps de traitement, et ce flux
     * lui renvoyait jusqu'ici l'activite de toute l'equipe.
     */
    @Test
    void byPeriod_shouldRestrictToOwnEventsWithoutTeamView() {
        var from = LocalDateTime.of(2026, 1, 1, 0, 0);
        var to = LocalDateTime.of(2026, 12, 31, 23, 59);
        var pageable = PageRequest.of(0, 10);
        CustomUserDetails principal = principalWith(RoleName.ANALYSTE_MARKETING, "ANALYTICS_VIEW");

        when(kpiService.getByPeriod(eq(from), eq(to), eq(false), any(), eq(pageable)))
                .thenReturn(new PageImpl<>(List.of()));

        var result = controller.byPeriod(from, to, principal, pageable);

        assertEquals(HttpStatus.OK, result.getStatusCode());
        verify(kpiService).getByPeriod(from, to, false, principal.getUserId(), pageable);
    }

    private static CustomUserDetails principalWith(RoleName roleName, String... permissionCodes) {
        try {
            var roleConstructor = Role.class.getDeclaredConstructor();
            roleConstructor.setAccessible(true);
            Role role = roleConstructor.newInstance();
            setField(Role.class, role, "name", roleName);
            setField(Role.class, role, "id", UUID.randomUUID());

            Set<Permission> permissions = new java.util.LinkedHashSet<>();
            for (String code : permissionCodes) {
                var permissionConstructor = Permission.class.getDeclaredConstructor();
                permissionConstructor.setAccessible(true);
                Permission permission = permissionConstructor.newInstance();
                setField(Permission.class, permission, "code", code);
                setField(Permission.class, permission, "id", UUID.randomUUID());
                permissions.add(permission);
            }
            setField(Role.class, role, "permissions", permissions);

            User user = new User("acteur@moov.bf", "$2a$hash", "Acteur", "Test", role);
            setField(User.class, user, "id", UUID.randomUUID());
            return new CustomUserDetails(user);
        } catch (Exception e) {
            throw new RuntimeException(e);
        }
    }

    private static void setField(Class<?> type, Object target, String fieldName, Object value) {
        try {
            Field field = type.getDeclaredField(fieldName);
            field.setAccessible(true);
            field.set(target, value);
        } catch (Exception e) {
            throw new RuntimeException(e);
        }
    }
}
