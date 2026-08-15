package com.moov.pim.lifecycle.repository;

import com.moov.pim.lifecycle.domain.OfferVersion;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.UUID;

public interface OfferVersionRepository extends JpaRepository<OfferVersion, UUID> {

    List<OfferVersion> findByOfferIdOrderByVersionNumberDesc(UUID offerId);
}
