package com.moov.pim.catalog.repository;

import com.moov.pim.catalog.domain.Pack;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.UUID;

public interface PackRepository extends JpaRepository<Pack, UUID> {
}
