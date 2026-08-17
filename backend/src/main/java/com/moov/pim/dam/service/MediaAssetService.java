package com.moov.pim.dam.service;

import com.moov.pim.dam.api.dto.LinkMediaRequest;
import com.moov.pim.dam.api.dto.MediaAssetResponse;
import com.moov.pim.dam.api.dto.MediaValidationRequest;
import com.moov.pim.dam.domain.ConformityStatus;
import com.moov.pim.dam.domain.MediaAsset;
import com.moov.pim.dam.domain.MediaValidation;
import com.moov.pim.dam.domain.OfferMedia;
import com.moov.pim.dam.domain.ValidationStatus;
import com.moov.pim.dam.repository.MediaAssetRepository;
import com.moov.pim.dam.repository.MediaValidationRepository;
import com.moov.pim.dam.repository.OfferMediaRepository;
import com.moov.pim.permissions.domain.RoleName;
import com.moov.pim.permissions.security.CustomUserDetails;
import com.moov.pim.shared.security.ClamAvScanService;
import io.minio.MinioClient;
import io.minio.PutObjectArgs;
import io.minio.RemoveObjectArgs;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

import java.io.BufferedInputStream;
import java.io.InputStream;
import java.net.URLConnection;
import java.util.List;
import java.util.Set;
import java.util.UUID;

@Service
public class MediaAssetService {

    private static final Logger log = LoggerFactory.getLogger(MediaAssetService.class);

    private static final Set<String> ALLOWED_MIME_TYPES = Set.of(
            "image/jpeg", "image/png", "image/gif", "image/webp", "image/svg+xml",
            "application/pdf",
            "video/mp4", "video/webm",
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
    );

    private static final Set<String> BLOCKED_EXTENSIONS = Set.of(
            ".exe", ".bat", ".cmd", ".sh", ".ps1", ".jar", ".war",
            ".php", ".jsp", ".cgi", ".py", ".rb", ".js", ".html", ".htm"
    );

    private final MediaAssetRepository mediaAssetRepository;
    private final MediaValidationRepository mediaValidationRepository;
    private final OfferMediaRepository offerMediaRepository;
    private final MinioClient minioClient;
    private final ClamAvScanService clamAvScanService;

    @Value("${pim.minio.bucket}")
    private String bucket;

    public MediaAssetService(MediaAssetRepository mediaAssetRepository,
                             MediaValidationRepository mediaValidationRepository,
                             OfferMediaRepository offerMediaRepository,
                             MinioClient minioClient,
                             ClamAvScanService clamAvScanService) {
        this.mediaAssetRepository = mediaAssetRepository;
        this.mediaValidationRepository = mediaValidationRepository;
        this.offerMediaRepository = offerMediaRepository;
        this.minioClient = minioClient;
        this.clamAvScanService = clamAvScanService;
    }

    @Transactional
    public MediaAssetResponse upload(MultipartFile file) {
        if (file.isEmpty()) {
            throw new IllegalArgumentException("Le fichier est vide");
        }

        String originalName = sanitizeFilename(file.getOriginalFilename());
        validateExtension(originalName);
        String detectedMime = detectMimeType(file);
        validateMimeType(detectedMime);

        try (InputStream scanStream = file.getInputStream()) {
            ClamAvScanService.ScanResult result = clamAvScanService.scan(scanStream);
            if (!result.clean()) {
                log.warn("ClamAV rejected file '{}': {}", originalName, result.message());
                throw new IllegalArgumentException("Le fichier a été rejeté par l'antivirus : " + result.message());
            }
        } catch (IllegalArgumentException e) {
            throw e;
        } catch (Exception e) {
            log.error("Antivirus scan error for '{}': {}", originalName, e.getMessage());
            throw new IllegalStateException("Erreur lors du scan antivirus");
        }

        String safeKey = "media/" + UUID.randomUUID() + "/" + originalName;

        try {
            minioClient.putObject(PutObjectArgs.builder()
                    .bucket(bucket)
                    .object(safeKey)
                    .stream(file.getInputStream(), file.getSize(), -1)
                    .contentType(detectedMime)
                    .build());
        } catch (Exception e) {
            log.error("Échec de l'upload MinIO: {}", e.getMessage());
            throw new IllegalStateException("Impossible d'uploader le fichier vers le stockage");
        }

        MediaAsset asset = new MediaAsset();
        asset.setFileName(originalName);
        asset.setMimeType(detectedMime);
        asset.setFileSize(file.getSize());
        asset.setStorageKey(safeKey);
        asset.setUploadedById(currentUserId());
        asset.setConformityStatus(ConformityStatus.PENDING);

        asset = mediaAssetRepository.save(asset);
        return MediaAssetResponse.from(asset);
    }

    private String sanitizeFilename(String name) {
        if (name == null || name.isBlank()) return "upload";
        String cleaned = name.replaceAll("[^a-zA-Z0-9._-]", "_");
        cleaned = cleaned.replaceAll("\\.{2,}", ".");
        if (cleaned.startsWith(".")) cleaned = "_" + cleaned;
        return cleaned.length() > 200 ? cleaned.substring(0, 200) : cleaned;
    }

    private void validateExtension(String filename) {
        String lower = filename.toLowerCase();
        for (String ext : BLOCKED_EXTENSIONS) {
            if (lower.endsWith(ext)) {
                throw new IllegalArgumentException("Type de fichier interdit : " + ext);
            }
        }
    }

    private String detectMimeType(MultipartFile file) {
        try (InputStream is = new BufferedInputStream(file.getInputStream())) {
            String detected = URLConnection.guessContentTypeFromStream(is);
            return detected != null ? detected : file.getContentType();
        } catch (Exception e) {
            return file.getContentType();
        }
    }

    private void validateMimeType(String mimeType) {
        if (mimeType == null || !ALLOWED_MIME_TYPES.contains(mimeType)) {
            throw new IllegalArgumentException(
                    "Type MIME non autorisé : " + (mimeType != null ? mimeType : "inconnu"));
        }
    }

    @Transactional
    public MediaAssetResponse validate(UUID mediaAssetId, MediaValidationRequest request) {
        MediaAsset asset = findAsset(mediaAssetId);

        MediaValidation validation = new MediaValidation();
        validation.setMediaAsset(asset);
        validation.setStatus(request.status());
        validation.setAnnotation(request.annotation());
        validation.setMediaType(request.mediaType());
        validation.setValidatedById(currentUserId());
        mediaValidationRepository.save(validation);

        if (request.status() == ValidationStatus.APPROVED) {
            asset.setConformityStatus(ConformityStatus.COMPLIANT);
        } else if (request.status() == ValidationStatus.REJECTED) {
            asset.setConformityStatus(ConformityStatus.NON_COMPLIANT);
        }
        asset = mediaAssetRepository.save(asset);
        return MediaAssetResponse.from(asset);
    }

    @Transactional
    public void linkToOffer(UUID offerId, LinkMediaRequest request) {
        findAsset(request.mediaAssetId());

        OfferMedia link = new OfferMedia();
        link.setOfferId(offerId);
        link.setMediaAsset(findAsset(request.mediaAssetId()));
        link.setPrimary(request.isPrimary());
        link.setDisplayOrder(request.displayOrder());
        offerMediaRepository.save(link);
    }

    @Transactional
    public void delete(UUID id) {
        MediaAsset asset = findAsset(id);

        UUID currentUser = currentUserId();
        boolean isAdmin = SecurityContextHolder.getContext().getAuthentication()
                .getAuthorities().stream()
                .anyMatch(a -> a.getAuthority().equals("USER_MANAGE"));
        if (!isAdmin && !currentUser.equals(asset.getUploadedById())) {
            throw new org.springframework.security.access.AccessDeniedException(
                    "Vous n'êtes pas autorisé à supprimer ce média");
        }

        try {
            minioClient.removeObject(RemoveObjectArgs.builder()
                    .bucket(bucket)
                    .object(asset.getStorageKey())
                    .build());
        } catch (Exception e) {
            log.warn("Impossible de supprimer le fichier MinIO {}: {}", asset.getStorageKey(), e.getMessage());
        }
        offerMediaRepository.deleteByMediaAssetId(id);
        mediaAssetRepository.delete(asset);
    }

    @Transactional(readOnly = true)
    public List<MediaAssetResponse> listByOffer(UUID offerId) {
        return offerMediaRepository.findByOfferIdOrderByDisplayOrderAsc(offerId).stream()
                .map(om -> MediaAssetResponse.from(om.getMediaAsset()))
                .toList();
    }

    @Transactional(readOnly = true)
    public List<MediaAssetResponse> listPending() {
        return mediaAssetRepository.findByConformityStatus(ConformityStatus.PENDING).stream()
                .map(MediaAssetResponse::from)
                .toList();
    }

    @Transactional(readOnly = true)
    public MediaAssetResponse getById(UUID id) {
        return MediaAssetResponse.from(findAsset(id));
    }

    private MediaAsset findAsset(UUID id) {
        return mediaAssetRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Média introuvable"));
    }

    private UUID currentUserId() {
        CustomUserDetails principal = (CustomUserDetails) SecurityContextHolder
                .getContext().getAuthentication().getPrincipal();
        return principal.getUserId();
    }
}
