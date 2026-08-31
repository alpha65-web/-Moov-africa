package com.moov.pim.dam.service;

import com.moov.pim.dam.domain.ConformityStatus;
import com.moov.pim.dam.domain.MediaAsset;
import com.moov.pim.dam.domain.OfferMedia;
import com.moov.pim.dam.repository.OfferMediaRepository;
import com.moov.pim.shared.workflow.GraphicValidationGate;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

/**
 * Verrou entre le circuit de validation graphique et le circuit metier.
 *
 * Le cahier des charges (7.6) enchaine les deux : « une fois la validation
 * graphique obtenue, l'offre poursuit vers la validation generale ». L'enchainement
 * manquait — une offre partait en validation metier avec des visuels encore en
 * attente, voire rejetes, et le chef de departement validait une fiche que le chef
 * de service n'avait pas approuvee.
 *
 * Le verrou est volontairement borne. Une offre sans visuel passe : il n'y a rien
 * a valider graphiquement, et l'arreter reviendrait a interdire de soumettre toute
 * offre qui n'en comporte pas, ce que la specification ne demande nulle part. Le
 * blocage ne porte donc que sur des visuels reellement deposes et pas encore
 * approuves.
 */
@Service
public class GraphicValidationService implements GraphicValidationGate {

    private static final Logger log = LoggerFactory.getLogger(GraphicValidationService.class);

    /** Au-dela, la liste des fichiers cites devient illisible dans le message. */
    private static final int NAMES_IN_MESSAGE = 3;

    private final OfferMediaRepository offerMediaRepository;

    public GraphicValidationService(OfferMediaRepository offerMediaRepository) {
        this.offerMediaRepository = offerMediaRepository;
    }

    @Override
    @Transactional(readOnly = true)
    public Optional<String> blockingReason(UUID offerId) {
        List<OfferMedia> linked = offerMediaRepository.findByOfferIdOrderByDisplayOrderAsc(offerId);
        if (linked.isEmpty()) {
            return Optional.empty();
        }

        List<MediaAsset> pending = linked.stream()
                .map(OfferMedia::getMediaAsset)
                .filter(asset -> asset != null && asset.getConformityStatus() != ConformityStatus.COMPLIANT)
                .toList();

        if (pending.isEmpty()) {
            return Optional.empty();
        }

        boolean anyRejected = pending.stream()
                .anyMatch(asset -> asset.getConformityStatus() == ConformityStatus.NON_COMPLIANT);

        // Nommer les fichiers en cause : « des visuels ne sont pas approuves » ne
        // dit pas lesquels, et l'analyste devrait ouvrir la mediatheque pour les
        // retrouver un a un.
        String names = pending.stream()
                .limit(NAMES_IN_MESSAGE)
                .map(MediaAsset::getFileName)
                .reduce((a, b) -> a + ", " + b)
                .orElse("");
        if (pending.size() > NAMES_IN_MESSAGE) {
            names += " et " + (pending.size() - NAMES_IN_MESSAGE) + " autre(s)";
        }

        String reason = anyRejected
                ? "Validation graphique incomplète : " + names
                  + " — un visuel rejeté doit être corrigé et redéposé avant la validation métier"
                : "Validation graphique en attente : " + names
                  + " — le chef de service doit se prononcer avant la validation métier";

        log.info("Offre {} retenue avant validation métier : {} visuel(s) non approuvé(s)",
                offerId, pending.size());
        return Optional.of(reason);
    }
}
