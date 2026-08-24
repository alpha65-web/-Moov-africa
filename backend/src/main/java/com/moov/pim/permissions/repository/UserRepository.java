package com.moov.pim.permissions.repository;

import com.moov.pim.permissions.domain.AccountStatus;
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

    /**
     * Titulaires actifs d'une permission donnee.
     *
     * Sert a adresser les notifications de cycle de vie a l'acteur de l'etape
     * suivante sans coder de role en dur : si la matrice role/permission evolue,
     * le routage suit sans modification de code.
     */
    @Query("""
            SELECT u FROM User u
            JOIN u.role r
            JOIN r.permissions p
            WHERE p.code = :code AND u.status = :status
            """)
    List<User> findByPermissionCodeAndStatus(String code, AccountStatus status);

    @Modifying
    @Query("UPDATE User u SET u.tokenVersion = u.tokenVersion + 1")
    int incrementAllTokenVersions();
}
