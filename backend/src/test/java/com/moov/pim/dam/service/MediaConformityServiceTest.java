package com.moov.pim.dam.service;

import com.moov.pim.dam.domain.ConformityStatus;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockMultipartFile;

import javax.imageio.ImageIO;
import java.awt.image.BufferedImage;
import java.io.ByteArrayOutputStream;
import java.nio.charset.StandardCharsets;
import java.util.zip.CRC32;

import static org.junit.jupiter.api.Assertions.*;

/**
 * Inspection automatique des medias.
 *
 * Le cahier des charges (7.5) impose que la plateforme verifie automatiquement la
 * resolution et le format, et signale les risques de droits d'auteur ; le circuit
 * de validation graphique (7.6) confie ces trois memes points au jugement du chef
 * de service. Aucun des trois n'etait mesure : width, height et resolution
 * valaient 0 pour tous les medias, aucun appelant de leurs setters n'existant dans
 * le depot.
 *
 * Les images de ces tests sont de vraies images, encodees a la volee : verifier
 * l'inspection sur des octets fabriques a la main ne prouverait rien du
 * comportement reel.
 */
class MediaConformityServiceTest {

    private final MediaConformityService service = new MediaConformityService();

    @Test
    void inspect_shouldMeasureTheDimensionsOfAnImage() throws Exception {
        MockMultipartFile file = png(1200, 900);

        MediaConformityService.ConformityReport report = service.inspect(file, "image/png");

        assertEquals(1200, report.width());
        assertEquals(900, report.height());
        assertEquals(ConformityStatus.PENDING, report.status(),
                "l'inspection ne déclare jamais un média conforme, elle instruit la validation graphique");
        assertTrue(report.findingsAsText().contains("1200 × 900"));
    }

    /**
     * Une vignette ne peut pas servir de visuel de fiche : elle est illisible des
     * qu'elle est affichee ailleurs qu'en miniature, sur le site comme au centre
     * d'appel. Le refus est automatique et motive.
     */
    @Test
    void inspect_shouldRejectAnImageTooSmallForAProductRecord() throws Exception {
        MockMultipartFile file = png(320, 240);

        MediaConformityService.ConformityReport report = service.inspect(file, "image/png");

        assertEquals(ConformityStatus.NON_COMPLIANT, report.status());
        assertTrue(report.findingsAsText().contains("240"));
        assertTrue(report.findingsAsText().contains(String.valueOf(MediaConformityService.MIN_IMAGE_SIDE_PX)));
    }

    /**
     * Un fichier qui annonce un type image sans en etre un doit etre refuse et non
     * enregistre a 0 x 0 comme s'il avait ete mesure.
     */
    @Test
    void inspect_shouldRejectAFileThatIsNotReallyAnImage() {
        MockMultipartFile file = new MockMultipartFile(
                "file", "faux.png", "image/png", "ceci n'est pas une image".getBytes(StandardCharsets.UTF_8));

        MediaConformityService.ConformityReport report = service.inspect(file, "image/png");

        assertEquals(ConformityStatus.NON_COMPLIANT, report.status());
        assertEquals(0, report.width());
        assertTrue(report.findingsAsText().contains("illisible"));
    }

    /**
     * Une notice PDF ou une video n'a pas de resolution mesurable ici. Le rapport
     * doit le dire, et non laisser un 0 x 0 se lire comme une mesure.
     */
    @Test
    void inspect_shouldSayWhenTheResolutionCannotBeMeasured() {
        MockMultipartFile file = new MockMultipartFile(
                "file", "notice.pdf", "application/pdf", "%PDF-1.7".getBytes(StandardCharsets.UTF_8));

        MediaConformityService.ConformityReport report = service.inspect(file, "application/pdf");

        assertEquals(ConformityStatus.PENDING, report.status());
        assertTrue(report.findingsAsText().contains("non mesurable"));
        assertFalse(report.copyrightRisk());
    }

    /** Une image vectorielle n'a pas de resolution, et c'est une qualite. */
    @Test
    void inspect_shouldNotMeasureAVectorImage() {
        MockMultipartFile file = new MockMultipartFile(
                "file", "logo.svg", "image/svg+xml", "<svg/>".getBytes(StandardCharsets.UTF_8));

        MediaConformityService.ConformityReport report = service.inspect(file, "image/svg+xml");

        assertEquals(ConformityStatus.PENDING, report.status());
        assertTrue(report.findingsAsText().contains("vectorielle"));
    }

    // ===================================================================
    // Droits d'auteur
    //
    // La plateforme ne peut pas savoir si un visuel est libre de droits. Ce
    // qu'elle peut faire, et qui a une valeur reelle pour le chef de service,
    // c'est remonter ce que le fichier declare de lui-meme.
    // ===================================================================

    @Test
    void inspect_shouldFlagAnImageCarryingSomeoneElsesCopyright() throws Exception {
        MockMultipartFile file = pngWithText("Copyright", "© 2026 Getty Images", 1200, 900);

        MediaConformityService.ConformityReport report = service.inspect(file, "image/png");

        assertTrue(report.copyrightRisk());
        assertTrue(report.copyrightNotice().contains("Getty"));
        assertTrue(report.findingsAsText().contains("vérifier avant publication"));
    }

    /** Un visuel qui porte la mention de Moov Africa n'est pas un risque. */
    @Test
    void inspect_shouldNotFlagAnImageBelongingToMoov() throws Exception {
        MockMultipartFile file = pngWithText("Copyright", "Moov Africa Burkina Faso", 1200, 900);

        MediaConformityService.ConformityReport report = service.inspect(file, "image/png");

        assertFalse(report.copyrightRisk());
        assertNotNull(report.copyrightNotice());
    }

    /** L'absence de mention ne prouve rien : elle se signale, elle ne condamne pas. */
    @Test
    void inspect_shouldReportTheAbsenceOfAnyCopyrightMention() throws Exception {
        MediaConformityService.ConformityReport report = service.inspect(png(1200, 900), "image/png");

        assertFalse(report.copyrightRisk());
        assertNull(report.copyrightNotice());
        assertTrue(report.findingsAsText().contains("aucune mention"));
    }

    /**
     * Les visuels issus d'une banque d'images sont presque toujours des JPEG, et
     * c'est dans leurs metadonnees EXIF que le detenteur des droits est inscrit.
     * Ce chemin de lecture est distinct de celui des PNG : il traverse le segment
     * APP1, l'en-tete TIFF et le premier repertoire d'etiquettes.
     */
    @Test
    void inspect_shouldReadTheCopyrightTagOfAJpeg() throws Exception {
        MockMultipartFile file = jpegWithExifCopyright("(c) 2026 Agence Photo SA", 1200, 900);

        MediaConformityService.ConformityReport report = service.inspect(file, "image/jpeg");

        assertEquals(1200, report.width());
        assertTrue(report.copyrightRisk());
        assertTrue(report.copyrightNotice().contains("Agence Photo"));
    }

    // ===================================================================

    private static MockMultipartFile png(int width, int height) throws Exception {
        return new MockMultipartFile("file", "visuel.png", "image/png", pngBytes(width, height));
    }

    private static byte[] pngBytes(int width, int height) throws Exception {
        BufferedImage image = new BufferedImage(width, height, BufferedImage.TYPE_INT_RGB);
        ByteArrayOutputStream out = new ByteArrayOutputStream();
        ImageIO.write(image, "png", out);
        return out.toByteArray();
    }

    /**
     * Insere un bloc tEXt normalise juste apres l'en-tete IHDR.
     *
     * Le bloc est construit avec son CRC reel : une image dont le CRC serait faux
     * ne serait plus decodable, et le test ne prouverait plus que l'inspection
     * fonctionne sur un fichier valide.
     */
    private static MockMultipartFile pngWithText(String keyword, String value, int width, int height)
            throws Exception {
        byte[] original = pngBytes(width, height);
        int ihdrEnd = 8 + 4 + 4 + 13 + 4; // signature + longueur + type + donnees IHDR + CRC

        byte[] keywordBytes = keyword.getBytes(StandardCharsets.ISO_8859_1);
        byte[] valueBytes = value.getBytes(StandardCharsets.ISO_8859_1);
        byte[] data = new byte[keywordBytes.length + 1 + valueBytes.length];
        System.arraycopy(keywordBytes, 0, data, 0, keywordBytes.length);
        data[keywordBytes.length] = 0; // separateur normalise du bloc tEXt
        System.arraycopy(valueBytes, 0, data, keywordBytes.length + 1, valueBytes.length);
        byte[] type = "tEXt".getBytes(StandardCharsets.US_ASCII);

        CRC32 crc = new CRC32();
        crc.update(type);
        crc.update(data);

        ByteArrayOutputStream out = new ByteArrayOutputStream();
        out.write(original, 0, ihdrEnd);
        out.write(intBytes(data.length));
        out.write(type);
        out.write(data);
        out.write(intBytes((int) crc.getValue()));
        out.write(original, ihdrEnd, original.length - ihdrEnd);

        return new MockMultipartFile("file", "visuel.png", "image/png", out.toByteArray());
    }

    private static byte[] intBytes(int value) {
        return new byte[]{
                (byte) (value >>> 24), (byte) (value >>> 16), (byte) (value >>> 8), (byte) value};
    }

    /**
     * Insere un segment APP1 « Exif » portant l'etiquette 0x8298 (Copyright) juste
     * apres le marqueur de debut d'image.
     *
     * Le JPEG reste decodable : le segment est normalise, un lecteur qui ne
     * s'interesse pas aux metadonnees le traverse sans s'en apercevoir. C'est ce
     * qui rend le test representatif d'un fichier reellement recu.
     */
    private static MockMultipartFile jpegWithExifCopyright(String notice, int width, int height)
            throws Exception {
        BufferedImage image = new BufferedImage(width, height, BufferedImage.TYPE_INT_RGB);
        ByteArrayOutputStream jpeg = new ByteArrayOutputStream();
        ImageIO.write(image, "jpg", jpeg);
        byte[] original = jpeg.toByteArray();

        byte[] value = (notice + " ").getBytes(StandardCharsets.ISO_8859_1);

        ByteArrayOutputStream tiff = new ByteArrayOutputStream();
        tiff.write(new byte[]{'I', 'I', 0x2A, 0x00});      // petit-boutiste, magie TIFF
        tiff.write(littleEndianInt(8));                     // premier repertoire a l'octet 8
        tiff.write(new byte[]{0x01, 0x00});                 // une seule etiquette
        tiff.write(new byte[]{(byte) 0x98, (byte) 0x82});   // 0x8298 : Copyright
        tiff.write(new byte[]{0x02, 0x00});                 // type ASCII
        tiff.write(littleEndianInt(value.length));
        tiff.write(littleEndianInt(26));                    // 8 en-tete + 18 repertoire
        tiff.write(littleEndianInt(0));                     // pas de repertoire suivant
        tiff.write(value);

        byte[] exif = tiff.toByteArray();
        int segmentLength = 2 + 6 + exif.length;            // longueur + « Exif   » + charge

        ByteArrayOutputStream out = new ByteArrayOutputStream();
        out.write(original, 0, 2);                          // marqueur de debut d'image
        out.write(new byte[]{(byte) 0xFF, (byte) 0xE1});    // APP1
        out.write(new byte[]{(byte) (segmentLength >>> 8), (byte) segmentLength});
        out.write(new byte[]{'E', 'x', 'i', 'f', 0, 0});
        out.write(exif);
        out.write(original, 2, original.length - 2);

        return new MockMultipartFile("file", "visuel.jpg", "image/jpeg", out.toByteArray());
    }

    private static byte[] littleEndianInt(int value) {
        return new byte[]{
                (byte) value, (byte) (value >>> 8), (byte) (value >>> 16), (byte) (value >>> 24)};
    }
}
