package com.moov.pim.dam.service;

import com.moov.pim.dam.api.dto.LinkMediaRequest;
import com.moov.pim.dam.api.dto.MediaAssetResponse;
import com.moov.pim.dam.api.dto.MediaValidationRequest;
import com.moov.pim.dam.api.dto.MediaValidationResponse;
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
import io.minio.GetObjectArgs;
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
import java.util.ArrayList;
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
    private final MediaConformityService conformityService;

    @Value("${pim.minio.bucket}")
    private String bucket;

    public MediaAssetService(MediaAssetRepository mediaAssetRepository,
                             MediaValidationRepository mediaValidationRepository,
                             OfferMediaRepository offerMediaRepository,
                             MinioClient minioClient,
                             ClamAvScanService clamAvScanService,
                             MediaConformityService conformityService) {
        this.mediaAssetRepository = mediaAssetRepository;
        this.mediaValidationRepository = mediaValidationRepository;
        this.offerMediaRepository = offerMediaRepository;
        this.minioClient = minioClient;
        this.clamAvScanService = clamAvScanService;
        this.conformityService = conformityService;
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

        // Verification automatique exigee par le cahier des charges (7.5) :
        // resolution, format, et signalement des risques de droits d'auteur. Elle
        // ne declare jamais un media conforme — c'est la validation graphique du
        // chef de service qui le fait — mais elle mesure ce qu'il doit juger, et
        // ecarte d'emblee ce qui ne peut pas convenir.
        MediaConformityService.ConformityReport report = conformityService.inspect(file, detectedMime);

        MediaAsset asset = new MediaAsset();
        asset.setFileName(originalName);
        asset.setMimeType(detectedMime);
        asset.setFileSize(file.getSize());
        asset.setStorageKey(safeKey);
        asset.setUploadedById(currentUserId());
        asset.setWidth(report.width());
        asset.setHeight(report.height());
        asset.setResolution(report.resolution());
        asset.setConformityStatus(report.status());
        asset.setCopyrightRisk(report.copyrightRisk());
        asset.setCopyrightNotice(report.copyrightNotice());
        asset.setConformityReport(report.findingsAsText());

        asset = mediaAssetRepository.save(asset);
        log.info("Média '{}' déposé : {} — {}", originalName, report.status(),
                String.join(" ; ", report.findings()));
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

    /**
     * Decision du chef de service sur un visuel.
     *
     * Un rejet sans motif est refuse. Le cahier des charges (7.6) confie a
     * l'analyste marketing la charge de « corriger et redeposer » apres un rejet :
     * sans motif, il ne sait pas quoi corriger et le circuit tourne a vide. Le
     * frontend fabriquait jusqu'ici l'annotation lui-meme a partir d'un libelle
     * generique, ce qui produisait en base des commentaires d'apparence humaine
     * qui ne renseignaient personne.
     */
    @Transactional
    public MediaAssetResponse validate(UUID mediaAssetId, MediaValidationRequest request) {
        MediaAsset asset = findAsset(mediaAssetId);

        if (request.status() == ValidationStatus.REJECTED
                && (request.annotation() == null || request.annotation().isBlank())) {
            throw new IllegalArgumentException(
                    "Un rejet doit etre motive : indiquez ce que l'analyste doit corriger");
        }

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

    /**
     * Redepot d'un visuel corrige, en nouvelle version du precedent.
     *
     * Le chainage manquait entierement : ni {@code parentMediaId} ni
     * {@code mediaVersion} n'etaient jamais ecrits — verifie par recherche de
     * leurs setters sur l'ensemble du depot. Un visuel corrige apres rejet
     * arrivait donc comme un media orphelin, sans lien avec celui qu'il
     * remplacait. La « comparaison de versions » du circuit de validation
     * graphique (7.6) et l'« historique visuel des versions, diff avant/apres »
     * de la mediatheque (7.5) n'avaient aucune donnee sur laquelle s'appuyer, et
     * le chef de service jugeait la correction sans voir ce qu'il avait rejete.
     *
     * La version se calcule depuis la racine de la chaine et non depuis le media
     * designe : redeposer deux fois de suite sur une meme version produirait
     * autrement deux « version 2 » concurrentes.
     */
    @Transactional
    public MediaAssetResponse uploadRevision(UUID previousId, MultipartFile file) {
        MediaAsset previous = findAsset(previousId);
        UUID rootId = previous.getParentMediaId() == null ? previous.getId() : previous.getParentMediaId();

        int nextVersion = mediaAssetRepository.findByParentMediaIdOrderByMediaVersionAsc(rootId).stream()
                .mapToInt(MediaAsset::getMediaVersion)
                .max()
                .orElse(findAsset(rootId).getMediaVersion()) + 1;

        MediaAssetResponse created = upload(file);
        MediaAsset revision = findAsset(created.id());
        revision.setParentMediaId(rootId);
        revision.setMediaVersion(nextVersion);

        log.info("Media {} redepose en version {} de la chaine {}",
                revision.getId(), nextVersion, rootId);
        return MediaAssetResponse.from(mediaAssetRepository.save(revision));
    }

    /**
     * Chaine complete des versions d'un visuel, de la premiere a la derniere.
     *
     * Le media designe peut etre n'importe quelle version : c'est toujours la
     * chaine entiere qui est renvoyee, sans quoi comparer l'avant et l'apres
     * dependrait de la version par laquelle on est entre.
     */
    @Transactional(readOnly = true)
    public List<MediaAssetResponse> listVersions(UUID mediaAssetId) {
        MediaAsset asset = findAsset(mediaAssetId);
        UUID rootId = asset.getParentMediaId() == null ? asset.getId() : asset.getParentMediaId();

        List<MediaAssetResponse> chain = new ArrayList<>();
        chain.add(MediaAssetResponse.from(findAsset(rootId)));
        mediaAssetRepository.findByParentMediaIdOrderByMediaVersionAsc(rootId).stream()
                .map(MediaAssetResponse::from)
                .forEach(chain::add);
        return chain;
    }

    /** Decisions prises sur un visuel, de la plus recente a la plus ancienne. */
    @Transactional(readOnly = true)
    public List<MediaValidationResponse> listValidations(UUID mediaAssetId) {
        findAsset(mediaAssetId);
        return mediaValidationRepository.findByMediaAssetIdOrderByCreatedAtDesc(mediaAssetId).stream()
                .map(MediaValidationResponse::from)
                .toList();
    }

    @Transactional(readOnly = true)
    public List<MediaAssetResponse> listByOffer(UUID offerId) {
        return offerMediaRepository.findByOfferIdOrderByDisplayOrderAsc(offerId).stream()
                .map(om -> MediaAssetResponse.from(om.getMediaAsset()))
                .toList();
    }

    @Transactional(readOnly = true)
    public List<MediaAssetResponse> listAll() {
        return mediaAssetRepository.findAll().stream()
                .map(MediaAssetResponse::from)
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

    /**
     * Contenu binaire d'un media, relu depuis MinIO.
     *
     * Le service ne connaissait que putObject et removeObject : les fichiers etaient
     * deposes et supprimes, jamais relus. La mediatheque n'affichait donc que des
     * fiches techniques, et le chef de service approuvait ou rejetait des visuels
     * qu'il ne pouvait pas voir, alors que le cahier des charges lui demande d'en
     * juger le format, la resolution et les droits d'auteur.
     */
    @Transactional(readOnly = true)
    public MediaContent download(UUID id) {
        MediaAsset asset = findAsset(id);
        try (InputStream stream = minioClient.getObject(GetObjectArgs.builder()
                .bucket(bucket)
                .object(asset.getStorageKey())
                .build())) {
            return new MediaContent(stream.readAllBytes(), asset.getMimeType(), asset.getFileName());
        } catch (Exception e) {
            log.error("Lecture MinIO impossible pour '{}' : {}", asset.getStorageKey(), e.getMessage());
            throw new IllegalStateException("Fichier introuvable dans le stockage");
        }
    }

    public record MediaContent(byte[] bytes, String mimeType, String fileName) {}

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
