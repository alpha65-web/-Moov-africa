package com.moov.pim.dam.repository;

import com.moov.pim.dam.domain.OfferMedia;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.UUID;

public interface OfferMediaRepository extends JpaRepository<OfferMedia, UUID> {

    List<OfferMedia> findByOfferIdOrderByDisplayOrderAsc(UUID offerId);

    boolean existsByOfferIdAndIsPrimaryTrue(UUID offerId);
}
