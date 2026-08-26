package com.moov.pim.catalog.service;

import com.moov.pim.catalog.domain.CatalogItem;
import com.moov.pim.catalog.domain.DuplicateFlag;
import com.moov.pim.catalog.domain.Product;
import com.moov.pim.catalog.repository.DuplicateFlagRepository;
import com.moov.pim.catalog.repository.ProductRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;

import java.lang.reflect.Field;
import java.util.List;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * Detection des doublons a la creation d'un produit (cahier des charges 7.2).
 *
 * La table duplicate_flags et son entite existaient depuis l'origine, mais aucun
 * code ne les alimentait : la detection n'avait jamais ete ecrite.
 */
@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class DuplicateDetectionServiceTest {

    @Mock private ProductRepository productRepository;
    @Mock private DuplicateFlagRepository duplicateFlagRepository;
    @InjectMocks private DuplicateDetectionService service;

    /**
     * C'est la forme que prend le doublon de saisie : meme produit, casse et
     * espacement differents.
     */
    @Test
    void deuxLibellesQuiNeDiffererentQueParLaCasseEtLesEspaces_sontRapproches() {
        Product existant = product("Tecno Spark 10");
        Product nouveau = product("TECNO Spark10");
        when(productRepository.findAll()).thenReturn(List.of(existant));

        List<Product> suspects = service.flagPotentialDuplicates(nouveau);

        assertEquals(1, suspects.size());
        verify(duplicateFlagRepository).save(any(DuplicateFlag.class));
    }

    /**
     * Un caractere de difference peut changer tout le sens : « 5 Go » et « 50 Go »
     * sont deux forfaits distincts, pas un doublon.
     */
    @Test
    void deuxForfaitsDeVolumesDifferents_neSontPasRapproches() {
        Product existant = product("Forfait 5 Go");
        Product nouveau = product("Forfait 50 Go");
        when(productRepository.findAll()).thenReturn(List.of(existant));

        assertTrue(service.flagPotentialDuplicates(nouveau).isEmpty());
        verify(duplicateFlagRepository, never()).save(any());
    }

    /** Un produit ne se rapproche pas de lui-meme. */
    @Test
    void leProduitNouvellementCree_neSeRapprochePasDeLuiMeme() {
        Product nouveau = product("Tecno Spark 10");
        when(productRepository.findAll()).thenReturn(List.of(nouveau));

        assertTrue(service.flagPotentialDuplicates(nouveau).isEmpty());
        verify(duplicateFlagRepository, never()).save(any());
    }

    /** Un rapprochement deja consigne ne l'est pas une seconde fois. */
    @Test
    void unRapprochementDejaConsigne_nEstPasDuplique() {
        Product existant = product("Tecno Spark 10");
        Product nouveau = product("TECNO Spark10");
        when(productRepository.findAll()).thenReturn(List.of(existant));
        when(duplicateFlagRepository.existsBySourceProductIdAndDuplicateProductId(any(), any()))
                .thenReturn(true);

        assertTrue(service.flagPotentialDuplicates(nouveau).isEmpty());
        verify(duplicateFlagRepository, never()).save(any());
    }

    /**
     * L'arbitrage conserve la trace de la decision plutot que de l'effacer : cela
     * evite qu'on rejuge indefiniment le meme cas.
     */
    @Test
    void ecarterUnRapprochement_leMarqueResoluSansLeSupprimer() {
        UUID flagId = UUID.randomUUID();
        UUID acteur = UUID.randomUUID();
        DuplicateFlag flag = new DuplicateFlag(UUID.randomUUID(), UUID.randomUUID(), 0.9f);
        when(duplicateFlagRepository.findById(flagId)).thenReturn(java.util.Optional.of(flag));

        service.resolve(flagId, acteur);

        assertTrue(flag.isResolved());
        assertEquals(acteur, flag.getResolvedById());
        verify(duplicateFlagRepository).save(flag);
        verify(duplicateFlagRepository, never()).delete(any());
    }

    @Test
    void normalisation_retireAccentsCasseEtPonctuation() {
        assertEquals("forfaitpremium", DuplicateDetectionService.normalize("Forfait Prémium !"));
        assertEquals("", DuplicateDetectionService.normalize(null));
    }

    @Test
    void similarite_vautUnPourDeuxLibellesIdentiques() {
        assertEquals(1f, DuplicateDetectionService.similarity("abc", "abc"));
        assertEquals(0f, DuplicateDetectionService.similarity("abc", ""));
    }

    /**
     * Regle de domaine : dans un catalogue telecom les chiffres designent un
     * volume, une capacite ou une generation de modele. Deux libelles dont les
     * nombres different ne sont jamais un doublon, si proche que soit le reste.
     */
    @Test
    void desNombresDifferents_annulentTouteRessemblance() {
        assertEquals(0f, DuplicateDetectionService.similarity("forfait5go", "forfait50go"));
        assertEquals(0f, DuplicateDetectionService.similarity("tecnospark10", "tecnospark20"));
        // Memes nombres, orthographe voisine : la ressemblance joue de nouveau.
        assertEquals(1f, DuplicateDetectionService.similarity("tecnospark10", "tecnospark10"));
    }

    /** Meme modele saisi avec une lettre de difference : rapproche. */
    @Test
    void uneVarianteDeSaisieSurLesLettres_resteRapprochee() {
        Product existant = product("Routeur Wifi 4G");
        Product nouveau = product("Routeur Wifii 4G");
        when(productRepository.findAll()).thenReturn(List.of(existant));

        assertEquals(1, service.flagPotentialDuplicates(nouveau).size());
    }

    private static Product product(String name) {
        Product product = new Product();
        product.setName(name);
        try {
            Field id = CatalogItem.class.getDeclaredField("id");
            id.setAccessible(true);
            id.set(product, UUID.randomUUID());
        } catch (Exception e) {
            throw new RuntimeException(e);
        }
        return product;
    }
}
