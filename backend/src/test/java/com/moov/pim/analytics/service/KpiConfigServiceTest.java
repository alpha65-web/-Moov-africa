package com.moov.pim.analytics.service;

import com.moov.pim.analytics.api.dto.KpiConfigResponse;
import com.moov.pim.analytics.api.dto.UpdateKpiConfigRequest;
import com.moov.pim.analytics.domain.KpiConfig;
import com.moov.pim.analytics.repository.KpiConfigRepository;
import com.moov.pim.permissions.domain.Role;
import com.moov.pim.permissions.domain.RoleName;
import com.moov.pim.permissions.domain.User;
import com.moov.pim.permissions.security.CustomUserDetails;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;

import java.lang.reflect.Field;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class KpiConfigServiceTest {

    @Mock private KpiConfigRepository configRepository;

    @InjectMocks private KpiConfigService kpiConfigService;

    private UUID userId;

    @BeforeEach
    void setUp() throws Exception {
        userId = UUID.randomUUID();
        Role role = createRole(RoleName.ADMIN_SYSTEME);
        User user = new User("admin@moov.bf", "$2a$hash", "Admin", "Sys", role);
        setField(User.class, user, "id", userId);

        CustomUserDetails details = new CustomUserDetails(user);
        SecurityContextHolder.getContext().setAuthentication(
                new UsernamePasswordAuthenticationToken(details, null, details.getAuthorities()));
    }

    @AfterEach
    void tearDown() {
        SecurityContextHolder.clearContext();
    }

    @Test
    void listAll_shouldReturnAllConfigs() {
        KpiConfig config = createConfig("ttm", "Time to Market");

        when(configRepository.findAll()).thenReturn(List.of(config));

        List<KpiConfigResponse> results = kpiConfigService.listAll();

        assertEquals(1, results.size());
        assertEquals("ttm", results.get(0).kpiCode());
        assertEquals("Time to Market", results.get(0).label());
    }

    @Test
    void update_shouldUpdateConfig() {
        UUID configId = UUID.randomUUID();
        KpiConfig config = createConfig("ttm", "Old Label");
        setField(KpiConfig.class, config, "id", configId);

        UpdateKpiConfigRequest request = new UpdateKpiConfigRequest("New Label", false, "> 48h");

        when(configRepository.findById(configId)).thenReturn(Optional.of(config));
        when(configRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));

        KpiConfigResponse response = kpiConfigService.update(configId, request);

        assertEquals("New Label", response.label());
        assertFalse(response.enabled());
        assertEquals("> 48h", response.thresholdExpression());
    }

    @Test
    void update_shouldThrowIfNotFound() {
        UUID fakeId = UUID.randomUUID();
        UpdateKpiConfigRequest request = new UpdateKpiConfigRequest("X", true, null);

        when(configRepository.findById(fakeId)).thenReturn(Optional.empty());

        assertThrows(IllegalArgumentException.class, () -> kpiConfigService.update(fakeId, request));
    }

    @Test
    void update_shouldKeepLabelIfNull() {
        UUID configId = UUID.randomUUID();
        KpiConfig config = createConfig("ttm", "Existing Label");
        setField(KpiConfig.class, config, "id", configId);

        UpdateKpiConfigRequest request = new UpdateKpiConfigRequest(null, true, null);

        when(configRepository.findById(configId)).thenReturn(Optional.of(config));
        when(configRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));

        KpiConfigResponse response = kpiConfigService.update(configId, request);

        assertEquals("Existing Label", response.label());
    }

    private KpiConfig createConfig(String kpiCode, String label) {
        try {
            var constructor = KpiConfig.class.getDeclaredConstructor();
            constructor.setAccessible(true);
            KpiConfig config = constructor.newInstance();
            setField(KpiConfig.class, config, "kpiCode", kpiCode);
            config.setLabel(label);
            config.setEnabled(true);
            setField(KpiConfig.class, config, "id", UUID.randomUUID());
            return config;
        } catch (Exception e) {
            throw new RuntimeException(e);
        }
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
