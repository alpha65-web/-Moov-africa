package com.moov.pim.dam.repository;

import com.moov.pim.dam.domain.AbTest;
import com.moov.pim.dam.domain.AbTestStatus;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.UUID;

public interface AbTestRepository extends JpaRepository<AbTest, UUID> {

    List<AbTest> findByOfferId(UUID offerId);

    List<AbTest> findByStatus(AbTestStatus status);
}
