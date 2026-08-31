package com.moov.pim.dam.service;

import com.moov.pim.dam.domain.ConformityStatus;
import com.moov.pim.dam.domain.MediaAsset;
import com.moov.pim.dam.domain.OfferMedia;
import com.moov.pim.dam.repository.OfferMediaRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.when;

/**
 * Verrou entre le circuit de validation graphique et le circuit metier.
 *
 * Le cahier des charges (7.6) enchaine les deux : « une fois la validation
 * graphique obtenue, l'offre poursuit vers la validation generale ». Cet
 * enchainement n'existait pas — le cycle de vie ne consultait jamais l'etat des
 * visuels, et le chef de departement pouvait valider une fiche dont le chef de
 * service n'avait approuve aucun media.
 */
@ExtendWith(MockitoExtension.class)
class GraphicValidationServiceTest {

    @Mock private OfferMediaRepository offerMediaRepository;
    @InjectMocks private GraphicValidationService service;

    /**
     * Une offre sans visuel n'a rien a faire valider graphiquement. La bloquer
     * reviendrait a interdire de soumettre toute offre qui n'en comporte pas, ce
     * que la specification ne demande nulle part.
     */
    @Test
    void blockingReason_shouldLetAnOfferWithoutAnyVisualThrough() {
        UUID offerId = UUID.randomUUID();
        when(offerMediaRepository.findByOfferIdOrderByDisplayOrderAsc(offerId)).thenReturn(List.of());

        assertTrue(service.blockingReason(offerId).isEmpty());
    }

    @Test
    void blockingReason_shouldLetAnOfferWithOnlyApprovedVisualsThrough() {
        UUID offerId = UUID.randomUUID();
        when(offerMediaRepository.findByOfferIdOrderByDisplayOrderAsc(offerId)).thenReturn(List.of(
                link(offerId, asset("bandeau.png", ConformityStatus.COMPLIANT)),
                link(offerId, asset("vignette.png", ConformityStatus.COMPLIANT))));

        assertTrue(service.blockingReason(offerId).isEmpty());
    }

    /**
     * Un visuel encore en attente signifie que le chef de service ne s'est pas
     * prononce : la fiche ne peut pas partir en validation metier.
     */
    @Test
    void blockingReason_shouldHoldBackAnOfferWithAPendingVisual() {
        UUID offerId = UUID.randomUUID();
        when(offerMediaRepository.findByOfferIdOrderByDisplayOrderAsc(offerId)).thenReturn(List.of(
                link(offerId, asset("bandeau.png", ConformityStatus.COMPLIANT)),
                link(offerId, asset("vignette.png", ConformityStatus.PENDING))));

        Optional<String> reason = service.blockingReason(offerId);

        assertTrue(reason.isPresent());
        assertTrue(reason.get().contains("vignette.png"), "le fichier en cause doit être nommé");
        assertTrue(reason.get().contains("attente"));
    }

    /** Un visuel rejete doit etre corrige et redepose : le motif le dit. */
    @Test
    void blockingReason_shouldDistinguishARejectedVisualFromAPendingOne() {
        UUID offerId = UUID.randomUUID();
        when(offerMediaRepository.findByOfferIdOrderByDisplayOrderAsc(offerId)).thenReturn(List.of(
                link(offerId, asset("bandeau.png", ConformityStatus.NON_COMPLIANT))));

        Optional<String> reason = service.blockingReason(offerId);

        assertTrue(reason.isPresent());
        assertTrue(reason.get().contains("rejeté"));
        assertTrue(reason.get().contains("redéposé"));
    }

    /**
     * Nommer les fichiers evite a l'analyste d'ouvrir la mediatheque pour les
     * retrouver un a un, mais une liste sans fin serait illisible : au-dela de
     * trois, le reste est compte.
     */
    @Test
    void blockingReason_shouldNameTheFirstFilesAndCountTheRest() {
        UUID offerId = UUID.randomUUID();
        when(offerMediaRepository.findByOfferIdOrderByDisplayOrderAsc(offerId)).thenReturn(List.of(
                link(offerId, asset("un.png", ConformityStatus.PENDING)),
                link(offerId, asset("deux.png", ConformityStatus.PENDING)),
                link(offerId, asset("trois.png", ConformityStatus.PENDING)),
                link(offerId, asset("quatre.png", ConformityStatus.PENDING)),
                link(offerId, asset("cinq.png", ConformityStatus.PENDING))));

        String reason = service.blockingReason(offerId).orElseThrow();

        assertTrue(reason.contains("un.png"));
        assertTrue(reason.contains("trois.png"));
        assertFalse(reason.contains("quatre.png"));
        assertTrue(reason.contains("2 autre(s)"));
    }

    // ===================================================================
    // Visuel accompagnant une diffusion
    // ===================================================================

    @Test
    void rejectionReason_refuseUnVisuelEtrangerALOffre() {
        UUID offerId = UUID.randomUUID();
        UUID mediaId = UUID.randomUUID();
        when(offerMediaRepository.findByOfferIdAndMediaAssetId(offerId, mediaId))
                .thenReturn(Optional.empty());

        assertTrue(service.rejectionReason(offerId, mediaId).orElseThrow()
                .contains("n'est pas rattaché"));
    }

    /**
     * Le point essentiel : un visuel rejete par le chef de service ne doit pas
     * pouvoir ressortir par la diffusion, le rejet visant precisement a
     * l'empecher de paraitre.
     */
    @Test
    void rejectionReason_refuseUnVisuelRejete() {
        UUID offerId = UUID.randomUUID();
        UUID mediaId = UUID.randomUUID();
        when(offerMediaRepository.findByOfferIdAndMediaAssetId(offerId, mediaId))
                .thenReturn(Optional.of(link(offerId, asset("rejete.png", ConformityStatus.NON_COMPLIANT))));

        assertTrue(service.rejectionReason(offerId, mediaId).orElseThrow()
                .contains("rejete.png"));
    }

    @Test
    void rejectionReason_refuseUnVisuelEncoreEnAttente() {
        UUID offerId = UUID.randomUUID();
        UUID mediaId = UUID.randomUUID();
        when(offerMediaRepository.findByOfferIdAndMediaAssetId(offerId, mediaId))
                .thenReturn(Optional.of(link(offerId, asset("attente.png", ConformityStatus.PENDING))));

        assertTrue(service.rejectionReason(offerId, mediaId).isPresent());
    }

    @Test
    void rejectionReason_accepteUnVisuelApprouveDeLOffre() {
        UUID offerId = UUID.randomUUID();
        UUID mediaId = UUID.randomUUID();
        when(offerMediaRepository.findByOfferIdAndMediaAssetId(offerId, mediaId))
                .thenReturn(Optional.of(link(offerId, asset("approuve.png", ConformityStatus.COMPLIANT))));

        assertTrue(service.rejectionReason(offerId, mediaId).isEmpty());
    }

    // ===================================================================

    private static OfferMedia link(UUID offerId, MediaAsset asset) {
        OfferMedia link = new OfferMedia();
        link.setOfferId(offerId);
        link.setMediaAsset(asset);
        return link;
    }

    private static MediaAsset asset(String fileName, ConformityStatus status) {
        MediaAsset asset = new MediaAsset();
        asset.setFileName(fileName);
        asset.setMimeType("image/png");
        asset.setStorageKey("media/" + UUID.randomUUID() + "/" + fileName);
        asset.setUploadedById(UUID.randomUUID());
        asset.setConformityStatus(status);
        return asset;
    }
}
