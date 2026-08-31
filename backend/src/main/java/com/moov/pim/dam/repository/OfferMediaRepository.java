package com.moov.pim.dam.repository;

import com.moov.pim.dam.domain.OfferMedia;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface OfferMediaRepository extends JpaRepository<OfferMedia, UUID> {

    List<OfferMedia> findByOfferIdOrderByDisplayOrderAsc(UUID offerId);

    boolean existsByOfferIdAndIsPrimaryTrue(UUID offerId);

    /**
     * Le rattachement d'un visuel precis a une offre precise, s'il existe.
     *
     * Sert au detachement et au refus des doublons : sans cette lecture,
     * {@code linkToOffer} inserait une seconde ligne pour un visuel deja
     * rattache, et rien ne permettait de designer le lien a supprimer.
     */
    Optional<OfferMedia> findByOfferIdAndMediaAssetId(UUID offerId, UUID mediaAssetId);

    boolean existsByOfferIdAndMediaAssetId(UUID offerId, UUID mediaAssetId);

    void deleteByMediaAssetId(UUID mediaAssetId);
}
