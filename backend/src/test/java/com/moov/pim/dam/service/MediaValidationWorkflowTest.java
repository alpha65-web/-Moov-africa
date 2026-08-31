package com.moov.pim.dam.service;

import com.moov.pim.dam.api.dto.MediaAssetResponse;
import com.moov.pim.dam.api.dto.MediaValidationRequest;
import com.moov.pim.dam.api.dto.MediaValidationResponse;
import com.moov.pim.dam.domain.AssetMediaType;
import com.moov.pim.dam.domain.ConformityStatus;
import com.moov.pim.dam.domain.MediaAsset;
import com.moov.pim.dam.domain.MediaValidation;
import com.moov.pim.dam.domain.ValidationStatus;
import com.moov.pim.dam.repository.MediaAssetRepository;
import com.moov.pim.dam.repository.MediaValidationRepository;
import com.moov.pim.dam.repository.OfferMediaRepository;
import com.moov.pim.permissions.domain.Role;
import com.moov.pim.permissions.domain.RoleName;
import com.moov.pim.permissions.domain.User;
import com.moov.pim.permissions.security.CustomUserDetails;
import com.moov.pim.shared.security.ClamAvScanService;
import io.minio.MinioClient;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.test.util.ReflectionTestUtils;
import org.springframework.web.multipart.MultipartFile;

import java.lang.reflect.Field;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.when;

/**
 * Circuit de validation graphique.
 *
 * Le cahier des charges (7.6) le decrit en trois temps : le chef de service juge
 * le visuel « avec annotation detaillee selon le type de media et comparaison de
 * versions », l'analyste marketing « corrige et redepose » en cas de rejet, et
 * l'offre poursuit ensuite vers la validation generale.
 *
 * Deux des trois maillons manquaient. L'annotation etait fabriquee par l'ecran a
 * partir d'un libelle generique, si bien qu'un rejet ne disait jamais quoi
 * corriger ; et le chainage des versions n'existait pas — ni parentMediaId ni
 * mediaVersion n'etaient jamais ecrits, un visuel corrige arrivant comme un media
 * orphelin, sans lien avec celui qu'il remplacait.
 */
@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class MediaValidationWorkflowTest {

    @Mock private MediaAssetRepository mediaAssetRepository;
    @Mock private MediaValidationRepository mediaValidationRepository;
    @Mock private OfferMediaRepository offerMediaRepository;
    @Mock private MinioClient minioClient;
    @Mock private ClamAvScanService clamAvScanService;
    @Mock private MediaConformityService conformityService;

    private MediaAssetService service;

    @BeforeEach
    void setUp() throws Exception {
        service = new MediaAssetService(mediaAssetRepository, mediaValidationRepository,
                offerMediaRepository, minioClient, clamAvScanService, conformityService);
        ReflectionTestUtils.setField(service, "bucket", "pim-media");

        Role role = createRole(RoleName.CHEF_SERVICE);
        User user = new User("chef.service@moov.bf", "$2a$hash", "Chef", "Service", role);
        setField(User.class, user, "id", UUID.randomUUID());
        CustomUserDetails details = new CustomUserDetails(user);
        SecurityContextHolder.getContext().setAuthentication(
                new UsernamePasswordAuthenticationToken(details, null, details.getAuthorities()));

        when(mediaValidationRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));

        // Le depot passe par l'antivirus et l'inspection : simules, seul le
        // chainage en base nous interesse ici.
        when(clamAvScanService.scan(any())).thenReturn(new ClamAvScanService.ScanResult(true, "OK"));
        when(conformityService.inspect(any(), any())).thenReturn(
                new MediaConformityService.ConformityReport(
                        1200, 900, 0, ConformityStatus.PENDING, false, null,
                        List.of("Format : image/png")));

        // Un media enregistre doit pouvoir etre relu ensuite : c'est ce que fait
        // le service lorsqu'il rattache la revision a sa chaine.
        when(mediaAssetRepository.save(any(MediaAsset.class))).thenAnswer(inv -> {
            MediaAsset candidate = inv.getArgument(0);
            if (candidate.getId() == null) {
                setField(MediaAsset.class, candidate, "id", UUID.randomUUID());
                setField(MediaAsset.class, candidate, "createdAt", LocalDateTime.now());
            }
            when(mediaAssetRepository.findById(candidate.getId())).thenReturn(Optional.of(candidate));
            return candidate;
        });
    }

    @AfterEach
    void tearDown() {
        SecurityContextHolder.clearContext();
    }

    // ===================================================================
    // Motivation du rejet
    // ===================================================================

    /**
     * Un rejet sans motif laisse l'analyste sans rien a corriger : le circuit
     * tourne a vide, le visuel repart identique et se fait rejeter a nouveau.
     */
    @Test
    void validate_shouldRefuseARejectionWithoutAReason() {
        MediaAsset asset = existing(1, null);

        MediaValidationRequest request =
                new MediaValidationRequest(ValidationStatus.REJECTED, "   ", AssetMediaType.IMAGE);

        IllegalArgumentException error = assertThrows(IllegalArgumentException.class,
                () -> service.validate(asset.getId(), request));
        assertTrue(error.getMessage().contains("motive"));
    }

    @Test
    void validate_shouldAcceptAMotivatedRejection() {
        MediaAsset asset = existing(1, null);

        MediaAssetResponse result = service.validate(asset.getId(), new MediaValidationRequest(
                ValidationStatus.REJECTED,
                "Le logo est sur fond bleu alors que la fiche s'affiche sur fond blanc",
                AssetMediaType.IMAGE));

        assertEquals(ConformityStatus.NON_COMPLIANT.name(), result.conformityStatus());
    }

    /** Une approbation n'a rien a justifier : elle ne demande rien a personne. */
    @Test
    void validate_shouldNotRequireAReasonToApprove() {
        MediaAsset asset = existing(1, null);

        MediaAssetResponse result = service.validate(asset.getId(),
                new MediaValidationRequest(ValidationStatus.APPROVED, null, AssetMediaType.IMAGE));

        assertEquals(ConformityStatus.COMPLIANT.name(), result.conformityStatus());
    }

    // ===================================================================
    // Chainage des versions
    // ===================================================================

    /**
     * Le visuel corrige doit se rattacher a celui qu'il remplace, sans quoi la
     * comparaison avant/apres n'a aucune donnee et le chef de service juge la
     * correction sans voir ce qu'il avait rejete.
     */
    @Test
    void uploadRevision_shouldChainTheCorrectedVisualToTheRejectedOne() {
        MediaAsset original = existing(1, null);
        when(mediaAssetRepository.findByParentMediaIdOrderByMediaVersionAsc(original.getId()))
                .thenReturn(List.of());

        MediaAssetResponse revision = service.uploadRevision(original.getId(), file());

        assertEquals(original.getId(), revision.parentMediaId());
        assertEquals(2, revision.mediaVersion());
    }

    /**
     * La version se compte depuis la racine de la chaine. Redeposer sur la
     * version 2 doit produire une version 3, non une seconde version 2 : deux
     * corrections successives porteraient sinon le meme numero.
     */
    @Test
    void uploadRevision_shouldCountFromTheRootOfTheChain() {
        MediaAsset root = existing(1, null);
        MediaAsset second = existing(2, root.getId());
        when(mediaAssetRepository.findByParentMediaIdOrderByMediaVersionAsc(root.getId()))
                .thenReturn(List.of(second));

        MediaAssetResponse revision = service.uploadRevision(second.getId(), file());

        assertEquals(root.getId(), revision.parentMediaId(), "la chaîne reste rattachée à sa racine");
        assertEquals(3, revision.mediaVersion());
    }

    @Test
    void listVersions_shouldReturnTheWholeChainWhicheverVersionIsAskedFor() {
        MediaAsset root = existing(1, null);
        MediaAsset second = existing(2, root.getId());
        when(mediaAssetRepository.findByParentMediaIdOrderByMediaVersionAsc(root.getId()))
                .thenReturn(List.of(second));

        List<MediaAssetResponse> fromRoot = service.listVersions(root.getId());
        List<MediaAssetResponse> fromSecond = service.listVersions(second.getId());

        assertEquals(2, fromRoot.size());
        assertEquals(fromRoot.size(), fromSecond.size());
        assertEquals(1, fromRoot.get(0).mediaVersion());
        assertEquals(2, fromRoot.get(1).mediaVersion());
    }

    // ===================================================================
    // Historique des decisions
    // ===================================================================

    /**
     * Les decisions etaient ecrites en base et jamais relues : aucune route ne les
     * exposait. L'analyste ne pouvait pas savoir ce qui lui etait reproche, et le
     * chef de service ne revoyait pas ses propres avis.
     */
    @Test
    void listValidations_shouldReturnTheDecisionsMostRecentFirst() {
        MediaAsset asset = existing(1, null);
        when(mediaValidationRepository.findByMediaAssetIdOrderByCreatedAtDesc(asset.getId()))
                .thenReturn(List.of(
                        validation(asset, ValidationStatus.APPROVED, "Corrigé, conforme à la charte"),
                        validation(asset, ValidationStatus.REJECTED, "Logo sur fond bleu")));

        List<MediaValidationResponse> history = service.listValidations(asset.getId());

        assertEquals(2, history.size());
        assertEquals("APPROVED", history.get(0).status());
        assertEquals("Logo sur fond bleu", history.get(1).annotation());
    }

    // ===================================================================

    /** Media deja en base, relisible par le service. */
    private MediaAsset existing(int version, UUID parentId) {
        MediaAsset asset = new MediaAsset();
        asset.setFileName("visuel.png");
        asset.setMimeType("image/png");
        asset.setStorageKey("media/" + UUID.randomUUID() + "/visuel.png");
        asset.setUploadedById(UUID.randomUUID());
        asset.setMediaVersion(version);
        asset.setParentMediaId(parentId);
        asset.setConformityStatus(ConformityStatus.PENDING);
        setField(MediaAsset.class, asset, "id", UUID.randomUUID());
        setField(MediaAsset.class, asset, "createdAt", LocalDateTime.now());
        when(mediaAssetRepository.findById(asset.getId())).thenReturn(Optional.of(asset));
        return asset;
    }

    private static MultipartFile file() {
        return new MockMultipartFile("file", "visuel.png", "image/png", new byte[]{1, 2, 3, 4});
    }

    private static MediaValidation validation(MediaAsset asset, ValidationStatus status, String annotation) {
        MediaValidation validation = new MediaValidation();
        validation.setMediaAsset(asset);
        validation.setStatus(status);
        validation.setAnnotation(annotation);
        validation.setMediaType(AssetMediaType.IMAGE);
        validation.setValidatedById(UUID.randomUUID());
        setField(MediaValidation.class, validation, "id", UUID.randomUUID());
        setField(MediaValidation.class, validation, "createdAt", LocalDateTime.now());
        return validation;
    }

    private static Role createRole(RoleName roleName) {
        try {
            var constructor = Role.class.getDeclaredConstructor();
            constructor.setAccessible(true);
            Role role = constructor.newInstance();
            setField(Role.class, role, "name", roleName);
            setField(Role.class, role, "id", UUID.randomUUID());
            return role;
        } catch (Exception e) {
            throw new RuntimeException(e);
        }
    }

    private static void setField(Class<?> clazz, Object target, String fieldName, Object value) {
        try {
            Field field = clazz.getDeclaredField(fieldName);
            field.setAccessible(true);
            field.set(target, value);
        } catch (Exception e) {
            throw new RuntimeException(e);
        }
    }
}
