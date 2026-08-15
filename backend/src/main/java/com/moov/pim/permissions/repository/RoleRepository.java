package com.moov.pim.permissions.repository;

import com.moov.pim.permissions.domain.Role;
import com.moov.pim.permissions.domain.RoleName;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;
import java.util.UUID;

public interface RoleRepository extends JpaRepository<Role, UUID> {

    Optional<Role> findByName(RoleName name);
}
