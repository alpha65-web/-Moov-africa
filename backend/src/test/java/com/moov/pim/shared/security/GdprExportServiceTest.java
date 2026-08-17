package com.moov.pim.shared.security;

import com.moov.pim.analytics.domain.AuditAction;
import com.moov.pim.analytics.domain.AuditLog;
import com.moov.pim.analytics.repository.AuditLogRepository;
import com.moov.pim.analytics.service.AuditService;
import com.moov.pim.dam.domain.MediaAsset;
import com.moov.pim.dam.repository.MediaAssetRepository;
import com.moov.pim.permissions.api.dto.GdprExportResponse;
import com.moov.pim.permissions.domain.Role;
import com.moov.pim.permissions.domain.RoleName;
import com.moov.pim.permissions.domain.User;
import com.moov.pim.permissions.repository.UserRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.lang.reflect.Field;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class GdprExportServiceTest {

    @Mock private UserRepository userRepository;
    @Mock private AuditLogRepository auditLogRepository;
    @Mock private MediaAssetRepository mediaAssetRepository;
    @Mock private AuditService auditService;

    @InjectMocks private GdprExportService gdprExportService;

    @Test
    void exportUserData_shouldReturnCompleteExport() throws Exception {
        UUID userId = UUID.randomUUID();
        UUID requestedBy = UUID.randomUUID();
        Role role = createRole(RoleName.CHEF_PRODUIT);
        User user = new User("chef@moov.bf", "$2a$hash", "Chef", "Produit", role);
        setField(User.class, user, "id", userId);

        AuditLog auditLog = new AuditLog(userId, AuditAction.CREATE, "Offer", UUID.randomUUID());
        setField(AuditLog.class, auditLog, "id", UUID.randomUUID());

        MediaAsset media = new MediaAsset();
        media.setFileName("logo.png");
        media.setMimeType("image/png");
        media.setFileSize(2048);
        media.setUploadedById(userId);
        setField(MediaAsset.class, media, "id", UUID.randomUUID());

        when(userRepository.findById(userId)).thenReturn(Optional.of(user));
        when(auditLogRepository.findByUserIdOrderByCreatedAtDesc(userId)).thenReturn(List.of(auditLog));
        when(mediaAssetRepository.findByUploadedById(userId)).thenReturn(List.of(media));

        GdprExportResponse response = gdprExportService.exportUserData(userId, requestedBy);

        assertNotNull(response);
        assertEquals("JSON", response.format());
        assertEquals("chef@moov.bf", response.profile().email());
        assertEquals("Chef", response.profile().firstName());
        assertEquals("CHEF_PRODUIT", response.profile().role());
        assertEquals(1, response.activityLog().size());
        assertEquals(1, response.uploadedMedia().size());
        assertEquals("logo.png", response.uploadedMedia().get(0).fileName());

        verify(auditService).log(
                eq(requestedBy), eq(AuditAction.DATA_EXPORT_REQUESTED),
                eq("User"), eq(userId), any(), any(), any());
    }

    @Test
    void exportUserData_shouldThrowIfUserNotFound() {
        UUID fakeId = UUID.randomUUID();
        UUID requestedBy = UUID.randomUUID();

        when(userRepository.findById(fakeId)).thenReturn(Optional.empty());

        assertThrows(IllegalArgumentException.class,
                () -> gdprExportService.exportUserData(fakeId, requestedBy));
    }

    @Test
    void exportUserData_shouldWorkWithEmptyActivity() throws Exception {
        UUID userId = UUID.randomUUID();
        UUID requestedBy = UUID.randomUUID();
        Role role = createRole(RoleName.CHEF_PRODUIT);
        User user = new User("user@moov.bf", "$2a$hash", "U", "Ser", role);
        setField(User.class, user, "id", userId);

        when(userRepository.findById(userId)).thenReturn(Optional.of(user));
        when(auditLogRepository.findByUserIdOrderByCreatedAtDesc(userId)).thenReturn(List.of());
        when(mediaAssetRepository.findByUploadedById(userId)).thenReturn(List.of());

        GdprExportResponse response = gdprExportService.exportUserData(userId, requestedBy);

        assertNotNull(response);
        assertTrue(response.activityLog().isEmpty());
        assertTrue(response.uploadedMedia().isEmpty());
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
