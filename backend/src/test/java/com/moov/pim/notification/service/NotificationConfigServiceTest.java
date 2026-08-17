package com.moov.pim.notification.service;

import com.moov.pim.notification.api.dto.NotificationConfigResponse;
import com.moov.pim.notification.api.dto.UpdateNotificationConfigRequest;
import com.moov.pim.notification.domain.NotificationConfig;
import com.moov.pim.notification.domain.NotificationType;
import com.moov.pim.notification.repository.NotificationConfigRepository;
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
class NotificationConfigServiceTest {

    @Mock private NotificationConfigRepository configRepository;

    @InjectMocks private NotificationConfigService configService;

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
        NotificationConfig config = createConfig(NotificationType.OFFER_PUBLISHED, "EMAIL");

        when(configRepository.findAll()).thenReturn(List.of(config));

        List<NotificationConfigResponse> results = configService.listAll();

        assertEquals(1, results.size());
        assertEquals("OFFER_PUBLISHED", results.get(0).type());
        assertEquals("EMAIL", results.get(0).channel());
    }

    @Test
    void update_shouldUpdateConfig() {
        UUID configId = UUID.randomUUID();
        NotificationConfig config = createConfig(NotificationType.OFFER_EXPIRING, "IN_APP");
        setField(NotificationConfig.class, config, "id", configId);

        UpdateNotificationConfigRequest request = new UpdateNotificationConfigRequest(false, "EMAIL");

        when(configRepository.findById(configId)).thenReturn(Optional.of(config));
        when(configRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));

        NotificationConfigResponse response = configService.update(configId, request);

        assertFalse(response.enabled());
        assertEquals("EMAIL", response.channel());
    }

    @Test
    void update_shouldThrowIfNotFound() {
        UUID fakeId = UUID.randomUUID();
        UpdateNotificationConfigRequest request = new UpdateNotificationConfigRequest(true, null);

        when(configRepository.findById(fakeId)).thenReturn(Optional.empty());

        assertThrows(IllegalArgumentException.class, () -> configService.update(fakeId, request));
    }

    @Test
    void update_shouldKeepChannelIfNull() {
        UUID configId = UUID.randomUUID();
        NotificationConfig config = createConfig(NotificationType.CAMPAIGN_READY, "SMS");
        setField(NotificationConfig.class, config, "id", configId);

        UpdateNotificationConfigRequest request = new UpdateNotificationConfigRequest(true, null);

        when(configRepository.findById(configId)).thenReturn(Optional.of(config));
        when(configRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));

        NotificationConfigResponse response = configService.update(configId, request);

        assertEquals("SMS", response.channel());
    }

    private NotificationConfig createConfig(NotificationType type, String channel) {
        try {
            var constructor = NotificationConfig.class.getDeclaredConstructor();
            constructor.setAccessible(true);
            NotificationConfig config = constructor.newInstance();
            setField(NotificationConfig.class, config, "type", type);
            config.setChannel(channel);
            config.setEnabled(true);
            setField(NotificationConfig.class, config, "id", UUID.randomUUID());
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
