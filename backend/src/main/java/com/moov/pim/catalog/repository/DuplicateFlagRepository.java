package com.moov.pim.catalog.repository;

import com.moov.pim.catalog.domain.DuplicateFlag;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.UUID;

/**
 * Rapprochements de doublons detectes a la creation d'un produit.
 *
 * L'entite et sa table existaient depuis l'origine, sans repertoire ni service :
 * la detection de doublons exigee par la section 7.2 du cahier des charges n'avait
 * jamais ete ecrite. Un meme terminal pouvait donc etre saisi deux fois sous deux
 * libelles voisins sans que rien ne le signale.
 */
public interface DuplicateFlagRepository extends JpaRepository<DuplicateFlag, UUID> {

    List<DuplicateFlag> findByResolvedFalseOrderByCreatedAtDesc();

    boolean existsBySourceProductIdAndDuplicateProductId(UUID sourceProductId, UUID duplicateProductId);
}
