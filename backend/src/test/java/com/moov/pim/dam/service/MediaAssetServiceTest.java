package com.moov.pim.dam.service;

import com.moov.pim.dam.api.dto.MediaAssetResponse;
import com.moov.pim.dam.api.dto.MediaValidationRequest;
import com.moov.pim.dam.domain.AssetMediaType;
import com.moov.pim.dam.domain.ConformityStatus;
import com.moov.pim.dam.domain.MediaAsset;
import com.moov.pim.dam.domain.OfferMedia;
import com.moov.pim.dam.domain.ValidationStatus;
import com.moov.pim.dam.repository.MediaAssetRepository;
import com.moov.pim.dam.repository.MediaValidationRepository;
import com.moov.pim.dam.repository.OfferMediaRepository;
import com.moov.pim.permissions.domain.Role;
import com.moov.pim.permissions.domain.RoleName;
import com.moov.pim.permissions.domain.User;
import com.moov.pim.permissions.security.CustomUserDetails;
import com.moov.pim.shared.security.ClamAvScanService;
import io.minio.MinioClient;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.multipart.MultipartFile;

import java.io.ByteArrayInputStream;
import java.lang.reflect.Field;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class MediaAssetServiceTest {

    @Mock private MediaAssetRepository mediaAssetRepository;
    @Mock private MediaValidationRepository mediaValidationRepository;
    @Mock private OfferMediaRepository offerMediaRepository;
    @Mock private MinioClient minioClient;
    @Mock private ClamAvScanService clamAvScanService;

    @InjectMocks private MediaAssetService mediaAssetService;

    private UUID userId;

    @BeforeEach
    void setUp() throws Exception {
        userId = UUID.randomUUID();
        Role role = createRole(RoleName.CHEF_PRODUIT);
        User user = new User("chef@moov.bf", "$2a$hash", "Chef", "Produit", role);
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
    void upload_shouldRejectEmptyFile() {
        MultipartFile file = mock(MultipartFile.class);
        when(file.isEmpty()).thenReturn(true);

        assertThrows(IllegalArgumentException.class, () -> mediaAssetService.upload(file));
    }

    @Test
    void upload_shouldRejectBlockedExtension() throws Exception {
        MultipartFile file = mock(MultipartFile.class);
        when(file.isEmpty()).thenReturn(false);
        when(file.getOriginalFilename()).thenReturn("malware.exe");

        assertThrows(IllegalArgumentException.class, () -> mediaAssetService.upload(file));
    }

    @Test
    void upload_shouldRejectBlockedExtensionBat() throws Exception {
        MultipartFile file = mock(MultipartFile.class);
        when(file.isEmpty()).thenReturn(false);
        when(file.getOriginalFilename()).thenReturn("script.bat");

        assertThrows(IllegalArgumentException.class, () -> mediaAssetService.upload(file));
    }

    @Test
    void upload_shouldRejectDisallowedMimeType() throws Exception {
        MultipartFile file = mock(MultipartFile.class);
        when(file.isEmpty()).thenReturn(false);
        when(file.getOriginalFilename()).thenReturn("doc.txt");
        when(file.getContentType()).thenReturn("text/plain");
        when(file.getInputStream()).thenReturn(new ByteArrayInputStream("content".getBytes()));

        assertThrows(IllegalArgumentException.class, () -> mediaAssetService.upload(file));
    }

    @Test
    void validate_shouldSetCompliantOnApproval() {
        UUID assetId = UUID.randomUUID();
        MediaAsset asset = createAsset(assetId, "photo.jpg", "image/jpeg");
        MediaValidationRequest request = new MediaValidationRequest(
                ValidationStatus.APPROVED, "OK", AssetMediaType.IMAGE);

        when(mediaAssetRepository.findById(assetId)).thenReturn(Optional.of(asset));
        when(mediaAssetRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));

        MediaAssetResponse response = mediaAssetService.validate(assetId, request);

        assertEquals("COMPLIANT", response.conformityStatus());
        verify(mediaValidationRepository).save(any());
    }

    @Test
    void validate_shouldSetNonCompliantOnRejection() {
        UUID assetId = UUID.randomUUID();
        MediaAsset asset = createAsset(assetId, "mauvais.png", "image/png");
        MediaValidationRequest request = new MediaValidationRequest(
                ValidationStatus.REJECTED, "Qualité insuffisante", AssetMediaType.IMAGE);

        when(mediaAssetRepository.findById(assetId)).thenReturn(Optional.of(asset));
        when(mediaAssetRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));

        MediaAssetResponse response = mediaAssetService.validate(assetId, request);

        assertEquals("NON_COMPLIANT", response.conformityStatus());
    }

    @Test
    void getById_shouldReturnAsset() {
        UUID assetId = UUID.randomUUID();
        MediaAsset asset = createAsset(assetId, "doc.pdf", "application/pdf");

        when(mediaAssetRepository.findById(assetId)).thenReturn(Optional.of(asset));

        MediaAssetResponse response = mediaAssetService.getById(assetId);

        assertEquals("doc.pdf", response.fileName());
    }

    @Test
    void getById_shouldThrowIfNotFound() {
        UUID fakeId = UUID.randomUUID();
        when(mediaAssetRepository.findById(fakeId)).thenReturn(Optional.empty());

        assertThrows(IllegalArgumentException.class, () -> mediaAssetService.getById(fakeId));
    }

    @Test
    void listPending_shouldReturnPendingAssets() {
        MediaAsset asset = createAsset(UUID.randomUUID(), "pending.jpg", "image/jpeg");

        when(mediaAssetRepository.findByConformityStatus(ConformityStatus.PENDING))
                .thenReturn(List.of(asset));

        List<MediaAssetResponse> results = mediaAssetService.listPending();

        assertEquals(1, results.size());
        assertEquals("pending.jpg", results.get(0).fileName());
    }

    @Test
    void listByOffer_shouldReturnLinkedAssets() {
        UUID offerId = UUID.randomUUID();
        MediaAsset asset = createAsset(UUID.randomUUID(), "linked.jpg", "image/jpeg");
        OfferMedia offerMedia = mock(OfferMedia.class);
        when(offerMedia.getMediaAsset()).thenReturn(asset);

        when(offerMediaRepository.findByOfferIdOrderByDisplayOrderAsc(offerId))
                .thenReturn(List.of(offerMedia));

        List<MediaAssetResponse> results = mediaAssetService.listByOffer(offerId);

        assertEquals(1, results.size());
        assertEquals("linked.jpg", results.get(0).fileName());
    }

    private MediaAsset createAsset(UUID id, String fileName, String mimeType) {
        MediaAsset asset = new MediaAsset();
        asset.setFileName(fileName);
        asset.setMimeType(mimeType);
        asset.setFileSize(1024);
        asset.setStorageKey("media/" + id + "/" + fileName);
        asset.setUploadedById(userId);
        asset.setConformityStatus(ConformityStatus.PENDING);
        setField(MediaAsset.class, asset, "id", id);
        return asset;
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
