package com.moov.pim.dam.repository;

import com.moov.pim.dam.domain.ConformityStatus;
import com.moov.pim.dam.domain.MediaAsset;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.UUID;

public interface MediaAssetRepository extends JpaRepository<MediaAsset, UUID> {

    List<MediaAsset> findByUploadedById(UUID userId);

    List<MediaAsset> findByConformityStatus(ConformityStatus status);

    List<MediaAsset> findByParentMediaId(UUID parentMediaId);
}
