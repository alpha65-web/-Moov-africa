package com.moov.pim.dam.api;

import com.moov.pim.dam.api.dto.LinkMediaRequest;
import com.moov.pim.dam.api.dto.MediaAssetResponse;
import com.moov.pim.dam.api.dto.MediaValidationRequest;
import com.moov.pim.dam.api.dto.MediaValidationResponse;
import com.moov.pim.dam.service.MediaAssetService;
import jakarta.validation.Valid;
import org.springframework.http.ContentDisposition;
import org.springframework.http.HttpHeaders;
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

    /**
     * Redepot d'un visuel corrige, apres un rejet.
     *
     * Reserve a MEDIA_UPLOAD, comme le depot initial : le cahier des charges (7.6)
     * confie a l'analyste marketing la charge de « corriger et redeposer », pas au
     * chef de service qui a rejete. La nouvelle version est chainee sur la
     * precedente, ce qui rend la comparaison avant/apres possible — sans ce
     * chainage, un visuel corrige arrivait comme un media orphelin et le chef de
     * service jugeait la correction sans voir ce qu'il avait rejete.
     */
    @PostMapping(value = "/{id}/revision", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    @PreAuthorize("hasAuthority('MEDIA_UPLOAD')")
    public ResponseEntity<MediaAssetResponse> uploadRevision(@PathVariable UUID id,
                                                             @RequestParam("file") MultipartFile file) {
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(mediaAssetService.uploadRevision(id, file));
    }

    /** Chaine des versions d'un visuel, pour la comparaison avant/apres. */
    @GetMapping("/{id}/versions")
    @PreAuthorize("hasAuthority('CATALOG_READ')")
    public ResponseEntity<List<MediaAssetResponse>> listVersions(@PathVariable UUID id) {
        return ResponseEntity.ok(mediaAssetService.listVersions(id));
    }

    /**
     * Decisions successives prises sur un visuel.
     *
     * Ouvert en lecture a tout compte pouvant consulter le catalogue : l'analyste
     * qui a depose doit lire le motif du rejet pour corriger, et le chef de service
     * doit revoir ses propres avis avant de juger une correction. Les decisions
     * etaient ecrites en base sans qu'aucune route ne les expose.
     */
    @GetMapping("/{id}/validations")
    @PreAuthorize("hasAuthority('CATALOG_READ')")
    public ResponseEntity<List<MediaValidationResponse>> listValidations(@PathVariable UUID id) {
        return ResponseEntity.ok(mediaAssetService.listValidations(id));
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

    @GetMapping
    @PreAuthorize("hasAuthority('CATALOG_READ')")
    public ResponseEntity<List<MediaAssetResponse>> listAll() {
        return ResponseEntity.ok(mediaAssetService.listAll());
    }

    @GetMapping("/pending")
    @PreAuthorize("hasAuthority('MEDIA_VALIDATE')")
    public ResponseEntity<List<MediaAssetResponse>> listPending() {
        return ResponseEntity.ok(mediaAssetService.listPending());
    }

    /**
     * Sert le fichier lui-meme, pour l'apercu de la mediatheque et le circuit de
     * validation graphique. Protege par CATALOG_READ, comme la fiche du media.
     */
    @GetMapping("/{id}/content")
    @PreAuthorize("hasAuthority('CATALOG_READ')")
    public ResponseEntity<byte[]> content(@PathVariable UUID id) {
        MediaAssetService.MediaContent content = mediaAssetService.download(id);
        return ResponseEntity.ok()
                .contentType(MediaType.parseMediaType(content.mimeType()))
                .header(HttpHeaders.CONTENT_DISPOSITION,
                        ContentDisposition.inline().filename(content.fileName()).build().toString())
                // Le contenu d'un media ne change jamais : sa cle de stockage est unique
                // par version. Le cache evite de le retelecharger a chaque affichage.
                .header(HttpHeaders.CACHE_CONTROL, "private, max-age=3600")
                .body(content.bytes());
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
