package com.moov.pim.permissions.api;

import com.moov.pim.permissions.api.dto.UpdateUserRequest;
import com.moov.pim.permissions.api.dto.UserResponse;
import com.moov.pim.permissions.domain.AccountStatus;
import com.moov.pim.permissions.domain.Role;
import com.moov.pim.permissions.domain.RoleName;
import com.moov.pim.permissions.domain.User;
import com.moov.pim.permissions.repository.RoleRepository;
import com.moov.pim.permissions.repository.UserRepository;
import com.moov.pim.permissions.security.CustomUserDetails;
import io.minio.GetObjectArgs;
import io.minio.MinioClient;
import io.minio.PutObjectArgs;
import io.minio.RemoveObjectArgs;
import io.minio.StatObjectArgs;
import java.io.BufferedInputStream;
import java.net.URLConnection;
import jakarta.validation.Valid;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.io.InputStreamResource;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

import java.io.InputStream;
import java.util.List;
import java.util.Set;
import java.util.UUID;

@RestController
@RequestMapping("/users")
public class UserController {

    private static final Logger log = LoggerFactory.getLogger(UserController.class);

    private static final Set<String> AVATAR_MIME_TYPES = Set.of(
            "image/jpeg", "image/png", "image/gif", "image/webp"
    );
    private static final long MAX_AVATAR_SIZE = 5 * 1024 * 1024;

    private final UserRepository userRepository;
    private final RoleRepository roleRepository;
    private final MinioClient minioClient;

    @Value("${pim.minio.bucket}")
    private String bucket;

    public UserController(UserRepository userRepository, RoleRepository roleRepository,
                          MinioClient minioClient) {
        this.userRepository = userRepository;
        this.roleRepository = roleRepository;
        this.minioClient = minioClient;
    }

    @GetMapping("/me")
    public ResponseEntity<UserResponse> me(@AuthenticationPrincipal CustomUserDetails principal) {
        return ResponseEntity.ok(UserResponse.from(principal.getUser()));
    }

    @GetMapping
    @PreAuthorize("hasAuthority('USER_MANAGE')")
    public ResponseEntity<List<UserResponse>> list() {
        List<UserResponse> users = userRepository.findAll().stream()
                .map(UserResponse::from)
                .toList();
        return ResponseEntity.ok(users);
    }

    @PatchMapping("/{id}/status")
    @PreAuthorize("hasAuthority('USER_MANAGE')")
    public ResponseEntity<UserResponse> updateStatus(@PathVariable UUID id,
                                                     @RequestParam AccountStatus status,
                                                     @AuthenticationPrincipal CustomUserDetails principal) {
        if (principal.getUserId().equals(id)) {
            throw new IllegalArgumentException("Impossible de modifier votre propre statut");
        }

        User user = userRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Utilisateur introuvable"));
        user.setStatus(status);
        if (status == AccountStatus.ACTIVE) {
            user.setFailedLoginAttempts(0);
        }
        user = userRepository.save(user);
        return ResponseEntity.ok(UserResponse.from(user));
    }

    @PutMapping("/{id}")
    @PreAuthorize("hasAuthority('USER_MANAGE')")
    public ResponseEntity<UserResponse> update(@PathVariable UUID id,
                                                @Valid @RequestBody UpdateUserRequest request) {
        User user = userRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Utilisateur introuvable"));

        user.setFirstName(request.firstName());
        user.setLastName(request.lastName());
        user.setSex(request.sex());

        if (request.roleName() != null) {
            RoleName roleName = RoleName.valueOf(request.roleName());
            Role role = roleRepository.findByName(roleName)
                    .orElseThrow(() -> new IllegalArgumentException("Rôle introuvable : " + request.roleName()));
            user.setRole(role);
        }

        user = userRepository.save(user);
        return ResponseEntity.ok(UserResponse.from(user));
    }

    @DeleteMapping("/{id}")
    @PreAuthorize("hasAuthority('USER_MANAGE')")
    public ResponseEntity<Void> delete(@PathVariable UUID id,
                                        @AuthenticationPrincipal CustomUserDetails principal) {
        if (principal.getUserId().equals(id)) {
            throw new IllegalArgumentException("Impossible de supprimer votre propre compte");
        }

        User user = userRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Utilisateur introuvable"));
        if (user.getAvatarKey() != null) {
            deleteFromMinio(user.getAvatarKey());
        }
        userRepository.delete(user);
        return ResponseEntity.noContent().build();
    }

    @PostMapping("/{id}/avatar")
    public ResponseEntity<UserResponse> uploadAvatar(@PathVariable UUID id,
                                                      @RequestParam("file") MultipartFile file,
                                                      @AuthenticationPrincipal CustomUserDetails principal) {
        boolean isAdmin = principal.getAuthorities().stream()
                .anyMatch(a -> a.getAuthority().equals("USER_MANAGE"));
        if (!isAdmin && !principal.getUserId().equals(id)) {
            throw new org.springframework.security.access.AccessDeniedException(
                    "Vous ne pouvez modifier que votre propre avatar");
        }

        if (file.isEmpty()) {
            throw new IllegalArgumentException("Le fichier est vide");
        }
        if (file.getSize() > MAX_AVATAR_SIZE) {
            throw new IllegalArgumentException("L'avatar ne doit pas depasser 5 Mo");
        }

        String detectedType = detectAvatarMimeType(file);
        if (!AVATAR_MIME_TYPES.contains(detectedType)) {
            throw new IllegalArgumentException("Format non autorise (JPEG, PNG, GIF, WebP uniquement)");
        }

        User user = userRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Utilisateur introuvable"));

        if (user.getAvatarKey() != null) {
            deleteFromMinio(user.getAvatarKey());
        }

        String extension = switch (detectedType) {
            case "image/png" -> ".png";
            case "image/gif" -> ".gif";
            case "image/webp" -> ".webp";
            default -> ".jpg";
        };
        String key = "avatars/" + id + "/" + UUID.randomUUID() + extension;

        try {
            minioClient.putObject(PutObjectArgs.builder()
                    .bucket(bucket)
                    .object(key)
                    .stream(file.getInputStream(), file.getSize(), -1)
                    .contentType(detectedType)
                    .build());
        } catch (Exception e) {
            log.error("Echec upload avatar MinIO: {}", e.getMessage());
            throw new IllegalStateException("Impossible d'uploader l'avatar");
        }

        user.setAvatarKey(key);
        user = userRepository.save(user);
        return ResponseEntity.ok(UserResponse.from(user));
    }

    @GetMapping("/{id}/avatar")
    public ResponseEntity<InputStreamResource> getAvatar(@PathVariable UUID id) {
        User user = userRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Utilisateur introuvable"));

        if (user.getAvatarKey() == null) {
            return ResponseEntity.notFound().build();
        }

        try {
            var stat = minioClient.statObject(StatObjectArgs.builder()
                    .bucket(bucket).object(user.getAvatarKey()).build());
            InputStream stream = minioClient.getObject(GetObjectArgs.builder()
                    .bucket(bucket).object(user.getAvatarKey()).build());
            return ResponseEntity.ok()
                    .contentType(MediaType.parseMediaType(stat.contentType()))
                    .body(new InputStreamResource(stream));
        } catch (Exception e) {
            log.warn("Impossible de lire l'avatar pour {}: {}", id, e.getMessage());
            return ResponseEntity.notFound().build();
        }
    }

    private String detectAvatarMimeType(MultipartFile file) {
        try (InputStream is = new BufferedInputStream(file.getInputStream())) {
            String detected = URLConnection.guessContentTypeFromStream(is);
            if (detected != null) return detected;
        } catch (Exception ignored) {
        }
        throw new IllegalArgumentException(
                "Impossible de determiner le type du fichier. Assurez-vous que le fichier n'est pas corrompu.");
    }

    private void deleteFromMinio(String key) {
        try {
            minioClient.removeObject(RemoveObjectArgs.builder()
                    .bucket(bucket).object(key).build());
        } catch (Exception e) {
            log.warn("Impossible de supprimer l'objet MinIO {}: {}", key, e.getMessage());
        }
    }
}
