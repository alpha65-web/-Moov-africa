package com.moov.pim.integration.repository;

import com.moov.pim.integration.domain.IntegrationEndpoint;
import com.moov.pim.integration.domain.TargetSystem;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface IntegrationEndpointRepository extends JpaRepository<IntegrationEndpoint, TargetSystem> {

    List<IntegrationEndpoint> findAllByOrderByTargetSystemAsc();
}
