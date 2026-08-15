package com.moov.pim.dam.api;

import com.moov.pim.dam.api.dto.LinkMediaRequest;
import com.moov.pim.dam.api.dto.MediaAssetResponse;
import com.moov.pim.dam.api.dto.MediaValidationRequest;
import com.moov.pim.dam.service.MediaAssetService;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/media")
public class MediaAssetController {

    private final MediaAssetService mediaAssetService;

    public MediaAssetController(MediaAssetService mediaAssetService) {
        this.mediaAssetService = mediaAssetService;
    }

    @PostMapping(consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    @PreAuthorize("hasAuthority('MEDIA_UPLOAD')")
    public ResponseEntity<MediaAssetResponse> upload(@RequestParam("file") MultipartFile file) {
        return ResponseEntity.status(HttpStatus.CREATED).body(mediaAssetService.upload(file));
    }

    @PostMapping("/{id}/validate")
    @PreAuthorize("hasAuthority('MEDIA_VALIDATE')")
    public ResponseEntity<MediaAssetResponse> validate(@PathVariable UUID id,
                                                       @Valid @RequestBody MediaValidationRequest request) {
        return ResponseEntity.ok(mediaAssetService.validate(id, request));
    }

    @PostMapping("/offers/{offerId}/link")
    @PreAuthorize("hasAuthority('MEDIA_UPLOAD')")
    public ResponseEntity<Void> linkToOffer(@PathVariable UUID offerId,
                                            @Valid @RequestBody LinkMediaRequest request) {
        mediaAssetService.linkToOffer(offerId, request);
        return ResponseEntity.status(HttpStatus.CREATED).build();
    }

    @GetMapping("/offers/{offerId}")
    @PreAuthorize("hasAuthority('CATALOG_READ')")
    public ResponseEntity<List<MediaAssetResponse>> listByOffer(@PathVariable UUID offerId) {
        return ResponseEntity.ok(mediaAssetService.listByOffer(offerId));
    }

    @GetMapping("/pending")
    @PreAuthorize("hasAuthority('MEDIA_VALIDATE')")
    public ResponseEntity<List<MediaAssetResponse>> listPending() {
        return ResponseEntity.ok(mediaAssetService.listPending());
    }

    @GetMapping("/{id}")
    @PreAuthorize("hasAuthority('CATALOG_READ')")
    public ResponseEntity<MediaAssetResponse> getById(@PathVariable UUID id) {
        return ResponseEntity.ok(mediaAssetService.getById(id));
    }

    @DeleteMapping("/{id}")
    @PreAuthorize("hasAuthority('MEDIA_UPLOAD')")
    public ResponseEntity<Void> delete(@PathVariable UUID id) {
        mediaAssetService.delete(id);
        return ResponseEntity.noContent().build();
    }
}
