package com.moov.pim.permissions.repository;

import com.moov.pim.permissions.domain.RoleName;
import com.moov.pim.permissions.domain.User;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface UserRepository extends JpaRepository<User, UUID> {

    Optional<User> findByEmail(String email);

    boolean existsByEmail(String email);

    List<User> findByRole_Name(RoleName roleName);

    @Modifying
    @Query("UPDATE User u SET u.tokenVersion = u.tokenVersion + 1")
    int incrementAllTokenVersions();
}
