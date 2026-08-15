package com.moov.pim.catalog.repository;

import com.moov.pim.catalog.domain.Service;
import com.moov.pim.catalog.domain.ServiceType;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.UUID;

public interface ServiceRepository extends JpaRepository<Service, UUID> {

    List<Service> findByServiceType(ServiceType serviceType);

    List<Service> findByCategoryId(UUID categoryId);
}
