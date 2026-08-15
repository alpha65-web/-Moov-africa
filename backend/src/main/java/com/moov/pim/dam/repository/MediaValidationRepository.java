package com.moov.pim.dam.repository;

import com.moov.pim.dam.domain.MediaValidation;
import com.moov.pim.dam.domain.ValidationStatus;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.UUID;

public interface MediaValidationRepository extends JpaRepository<MediaValidation, UUID> {

    List<MediaValidation> findByMediaAssetId(UUID mediaAssetId);

    List<MediaValidation> findByStatus(ValidationStatus status);
}
