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
import com.moov.pim.permissions.security.CustomUserDetails;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

import java.util.List;
import java.util.UUID;

@Service
public class MediaAssetService {

    private final MediaAssetRepository mediaAssetRepository;
    private final MediaValidationRepository mediaValidationRepository;
    private final OfferMediaRepository offerMediaRepository;

    public MediaAssetService(MediaAssetRepository mediaAssetRepository,
                             MediaValidationRepository mediaValidationRepository,
                             OfferMediaRepository offerMediaRepository) {
        this.mediaAssetRepository = mediaAssetRepository;
        this.mediaValidationRepository = mediaValidationRepository;
        this.offerMediaRepository = offerMediaRepository;
    }

    @Transactional
    public MediaAssetResponse upload(MultipartFile file) {
        MediaAsset asset = new MediaAsset();
        asset.setFileName(file.getOriginalFilename());
        asset.setMimeType(file.getContentType());
        asset.setFileSize(file.getSize());
        asset.setStorageKey("media/" + UUID.randomUUID() + "/" + file.getOriginalFilename());
        asset.setUploadedById(currentUserId());

        // Simulated: conformity check placeholder
        asset.setConformityStatus(ConformityStatus.PENDING);

        asset = mediaAssetRepository.save(asset);
        return MediaAssetResponse.from(asset);
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
