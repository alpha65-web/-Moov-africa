package com.moov.pim.dam.service;

import com.moov.pim.dam.domain.ConformityStatus;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import javax.imageio.ImageIO;
import javax.imageio.ImageReader;
import javax.imageio.stream.ImageInputStream;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.Iterator;
import java.util.List;
import java.util.Locale;

/**
 * Inspection automatique d'un media depose.
 *
 * Le cahier des charges (7.5) demande que la plateforme « verifie automatiquement
 * la conformite des medias : resolution, format, et signale les risques lies aux
 * droits d'auteur », et le circuit de validation graphique (7.6) confie au chef de
 * service le jugement sur ces trois memes points.
 *
 * Rien de tout cela n'etait mesure. Les colonnes width, height et resolution de
 * media_assets existaient depuis la migration V006 mais n'etaient ecrites nulle
 * part — verifie par recherche de setWidth, setHeight, setResolution et
 * setCopyrightRisk sur l'ensemble du depot : aucun appelant. Tout media valait
 * donc 0x0, aucun risque de droits n'etait jamais signale, et le chef de service
 * devait juger le format et la resolution d'un visuel sans qu'aucun des deux ne
 * lui soit presente.
 *
 * L'inspection ne remplace pas ce jugement, elle l'instruit : elle ne declare
 * jamais un media conforme — seule la validation graphique le fait — mais elle
 * ecarte d'emblee ce qui ne peut pas convenir, et elle remonte ce que le fichier
 * dit de lui-meme.
 */
@Service
public class MediaConformityService {

    private static final Logger log = LoggerFactory.getLogger(MediaConformityService.class);

    /**
     * Cote minimal d'un visuel de fiche produit.
     *
     * En dessous, l'image est inexploitable des qu'elle est affichee autrement
     * qu'en vignette : ni sur la fiche du site, ni dans le CRM, ni au centre
     * d'appel. Le seuil est volontairement bas — il ecarte les captures d'ecran
     * et les miniatures recuperees a la va-vite, pas les visuels perfectibles,
     * dont l'appreciation revient au chef de service.
     */
    static final int MIN_IMAGE_SIDE_PX = 800;

    /** Au-dela, l'inspection ne lit plus le fichier : elle ne cherche que des en-tetes. */
    private static final int METADATA_SCAN_BYTES = 256 * 1024;

    /**
     * Resultat de l'inspection.
     *
     * @param width       largeur en pixels, 0 lorsqu'elle n'est pas mesurable
     * @param height      hauteur en pixels, 0 lorsqu'elle n'est pas mesurable
     * @param resolution  resolution en points par pouce declaree par le fichier,
     *                    0 lorsqu'il n'en declare aucune. Elle n'est jamais
     *                    supposee : afficher 72 ppp par defaut ferait passer une
     *                    valeur absente pour une valeur constatee.
     * @param status      NON_COMPLIANT quand le media ne peut pas convenir,
     *                    PENDING sinon — la conformite se decide en validation
     *                    graphique, pas ici.
     * @param findings    constats destines au chef de service, en clair
     * @param copyrightNotice mention de droits trouvee dans le fichier, s'il y en a
     */
    public record ConformityReport(
            int width,
            int height,
            int resolution,
            ConformityStatus status,
            boolean copyrightRisk,
            String copyrightNotice,
            List<String> findings
    ) {
        public String findingsAsText() {
            return String.join("\n", findings);
        }
    }

    public ConformityReport inspect(MultipartFile file, String mimeType) {
        List<String> findings = new ArrayList<>();
        findings.add("Format : " + mimeType + " — accepté");

        if (mimeType == null || !mimeType.startsWith("image/")) {
            findings.add("Résolution : non mesurable sur ce type de fichier, "
                    + "à apprécier visuellement lors de la validation graphique");
            return new ConformityReport(0, 0, 0, ConformityStatus.PENDING, false, null, findings);
        }

        // Le SVG est vectoriel : il n'a pas de resolution, et c'est une qualite,
        // pas un manque. Le mesurer en pixels n'aurait aucun sens.
        if ("image/svg+xml".equals(mimeType)) {
            findings.add("Image vectorielle : elle reste nette à toute taille d'affichage");
            return new ConformityReport(0, 0, 0, ConformityStatus.PENDING, false, null, findings);
        }

        int[] dimensions = readDimensions(file);
        int width = dimensions[0];
        int height = dimensions[1];

        if (width == 0 || height == 0) {
            findings.add("Image illisible : le fichier porte un type " + mimeType
                    + " mais son contenu n'a pas pu être décodé");
            return new ConformityReport(0, 0, 0, ConformityStatus.NON_COMPLIANT, false, null, findings);
        }

        findings.add("Résolution : " + width + " × " + height + " pixels");

        byte[] header = readHeader(file);
        int dpi = readDpi(header, mimeType);
        if (dpi > 0) {
            findings.add("Densité déclarée : " + dpi + " ppp");
        }

        ConformityStatus status = ConformityStatus.PENDING;
        int smallestSide = Math.min(width, height);
        if (smallestSide < MIN_IMAGE_SIDE_PX) {
            status = ConformityStatus.NON_COMPLIANT;
            findings.add("Refusé : le plus petit côté fait " + smallestSide + " pixels, "
                    + "le minimum attendu pour un visuel de fiche est de " + MIN_IMAGE_SIDE_PX);
        }

        String notice = readCopyrightNotice(header, mimeType);
        boolean risk = notice != null && !notice.toLowerCase(Locale.ROOT).contains("moov");
        if (notice != null) {
            findings.add(risk
                    ? "Droits d'auteur : le fichier porte la mention « " + notice
                      + " », qui ne désigne pas Moov Africa — à vérifier avant publication"
                    : "Droits d'auteur : le fichier porte la mention « " + notice + " »");
        } else {
            findings.add("Droits d'auteur : le fichier ne porte aucune mention, "
                    + "l'origine du visuel reste à confirmer par le déposant");
        }

        return new ConformityReport(width, height, dpi, status, risk, notice, findings);
    }

    /**
     * Dimensions en pixels, lues sur l'en-tete seul.
     *
     * ImageIO n'a pas besoin de decoder l'image entiere pour les connaitre : la
     * lecture reste bornee meme sur un fichier volumineux.
     */
    private int[] readDimensions(MultipartFile file) {
        try (InputStream stream = file.getInputStream();
             ImageInputStream imageStream = ImageIO.createImageInputStream(stream)) {

            if (imageStream == null) {
                return new int[]{0, 0};
            }
            Iterator<ImageReader> readers = ImageIO.getImageReaders(imageStream);
            if (!readers.hasNext()) {
                return new int[]{0, 0};
            }
            ImageReader reader = readers.next();
            try {
                reader.setInput(imageStream);
                return new int[]{reader.getWidth(0), reader.getHeight(0)};
            } finally {
                reader.dispose();
            }
        } catch (Exception e) {
            log.warn("Dimensions illisibles pour '{}' : {}", file.getOriginalFilename(), e.getMessage());
            return new int[]{0, 0};
        }
    }

    private byte[] readHeader(MultipartFile file) {
        try (InputStream stream = file.getInputStream()) {
            return stream.readNBytes(METADATA_SCAN_BYTES);
        } catch (Exception e) {
            log.warn("En-tête illisible pour '{}' : {}", file.getOriginalFilename(), e.getMessage());
            return new byte[0];
        }
    }

    /**
     * Densite declaree par le fichier, en points par pouce.
     *
     * Deux sources selon le format, toutes deux normalisees : le segment JFIF d'un
     * JPEG et le bloc pHYs d'un PNG. Un fichier qui n'en declare aucune renvoie 0,
     * jamais une valeur par defaut.
     */
    private int readDpi(byte[] header, String mimeType) {
        try {
            if ("image/jpeg".equals(mimeType)) {
                return jfifDpi(header);
            }
            if ("image/png".equals(mimeType)) {
                return pngDpi(header);
            }
        } catch (Exception e) {
            log.debug("Densité illisible : {}", e.getMessage());
        }
        return 0;
    }

    /** Segment APP0 « JFIF » : unites (1 = ppp, 2 = points/cm) puis densites X et Y. */
    private int jfifDpi(byte[] b) {
        for (int i = 0; i + 13 < b.length && i < 1024; i++) {
            if ((b[i] & 0xFF) == 0xFF && (b[i + 1] & 0xFF) == 0xE0
                    && b[i + 4] == 'J' && b[i + 5] == 'F' && b[i + 6] == 'I' && b[i + 7] == 'F') {
                int units = b[i + 11] & 0xFF;
                int density = ((b[i + 12] & 0xFF) << 8) | (b[i + 13] & 0xFF);
                if (density <= 0) return 0;
                if (units == 1) return density;
                if (units == 2) return Math.round(density * 2.54f);
                return 0;
            }
        }
        return 0;
    }

    /** Bloc pHYs : pixels par unite en X, puis unite (1 = metre). */
    private int pngDpi(byte[] b) {
        int at = indexOf(b, "pHYs".getBytes(StandardCharsets.US_ASCII), 0);
        if (at < 0 || at + 12 > b.length) return 0;

        long perUnitX = ((long) (b[at + 4] & 0xFF) << 24) | ((b[at + 5] & 0xFF) << 16)
                | ((b[at + 6] & 0xFF) << 8) | (b[at + 7] & 0xFF);
        int unit = b[at + 12] & 0xFF;
        if (unit != 1 || perUnitX <= 0) return 0;
        return (int) Math.round(perUnitX * 0.0254);
    }

    /**
     * Mention de droits d'auteur inscrite dans le fichier lui-meme.
     *
     * La plateforme ne peut pas savoir si un visuel est libre de droits : aucune
     * verification automatique ne le permet, et pretendre le contraire serait
     * malhonnete. Ce qu'elle peut faire, et qui a une valeur reelle pour le chef
     * de service, c'est remonter ce que le fichier declare : un JPEG issu d'une
     * banque d'images porte presque toujours son detenteur dans ses metadonnees
     * EXIF, un PNG exporte depuis un outil de creation porte son auteur.
     *
     * Une mention trouvee ne prouve pas une infraction, et son absence ne prouve
     * rien du tout. Le libelle presente donc un signalement, jamais un verdict.
     */
    private String readCopyrightNotice(byte[] header, String mimeType) {
        try {
            if ("image/png".equals(mimeType)) {
                return pngTextualNotice(header);
            }
            if ("image/jpeg".equals(mimeType)) {
                return exifNotice(header);
            }
        } catch (Exception e) {
            log.debug("Métadonnées de droits illisibles : {}", e.getMessage());
        }
        return null;
    }

    /** Blocs tEXt et iTXt : mot-cle terminé par 0x00, puis la valeur. */
    private String pngTextualNotice(byte[] b) {
        for (String keyword : new String[]{"Copyright", "Artist", "Author"}) {
            byte[] needle = keyword.getBytes(StandardCharsets.ISO_8859_1);
            int at = indexOf(b, needle, 0);
            if (at < 0) continue;

            int valueStart = at + needle.length;
            while (valueStart < b.length && b[valueStart] == 0) {
                valueStart++;
            }
            int end = valueStart;
            // Comparaison non signee : un caractere accentue vaut un octet negatif
            // en Java, et une mention « © Getty » se serait arretee au premier signe.
            while (end < b.length && (b[end] & 0xFF) >= 0x20 && end - valueStart < 200) {
                end++;
            }
            String value = new String(b, valueStart, end - valueStart, StandardCharsets.ISO_8859_1).trim();
            if (!value.isEmpty()) {
                return value;
            }
        }
        return null;
    }

    /**
     * Etiquettes EXIF 0x8298 (Copyright) et 0x013B (Artist) du premier repertoire.
     *
     * Le segment APP1 commence par « Exif\0\0 », suivi d'un en-tete TIFF dont
     * l'ordre des octets est declare par « II » (petit-boutiste) ou « MM ».
     */
    private String exifNotice(byte[] b) {
        int app1 = indexOf(b, new byte[]{'E', 'x', 'i', 'f', 0, 0}, 0);
        if (app1 < 0) return null;

        int tiff = app1 + 6;
        if (tiff + 8 > b.length) return null;

        boolean littleEndian = b[tiff] == 'I' && b[tiff + 1] == 'I';
        int ifdOffset = readInt(b, tiff + 4, littleEndian);
        int ifd = tiff + ifdOffset;
        if (ifd + 2 > b.length || ifd < tiff) return null;

        int entries = readShort(b, ifd, littleEndian);
        for (int i = 0; i < entries && i < 512; i++) {
            int entry = ifd + 2 + i * 12;
            if (entry + 12 > b.length) break;

            int tag = readShort(b, entry, littleEndian);
            if (tag != 0x8298 && tag != 0x013B) continue;

            int count = readInt(b, entry + 4, littleEndian);
            if (count <= 0 || count > 512) continue;

            int valueAt = count <= 4 ? entry + 8 : tiff + readInt(b, entry + 8, littleEndian);
            if (valueAt < 0 || valueAt + count > b.length) continue;

            String value = new String(b, valueAt, count, StandardCharsets.ISO_8859_1)
                    .replace("\u0000", "").trim();
            if (!value.isEmpty()) {
                return value.length() > 200 ? value.substring(0, 200) : value;
            }
        }
        return null;
    }

    private static int readShort(byte[] b, int at, boolean littleEndian) {
        return littleEndian
                ? (b[at] & 0xFF) | ((b[at + 1] & 0xFF) << 8)
                : ((b[at] & 0xFF) << 8) | (b[at + 1] & 0xFF);
    }

    private static int readInt(byte[] b, int at, boolean littleEndian) {
        return littleEndian
                ? (b[at] & 0xFF) | ((b[at + 1] & 0xFF) << 8) | ((b[at + 2] & 0xFF) << 16) | ((b[at + 3] & 0xFF) << 24)
                : ((b[at] & 0xFF) << 24) | ((b[at + 1] & 0xFF) << 16) | ((b[at + 2] & 0xFF) << 8) | (b[at + 3] & 0xFF);
    }

    private static int indexOf(byte[] haystack, byte[] needle, int from) {
        outer:
        for (int i = from; i <= haystack.length - needle.length; i++) {
            for (int j = 0; j < needle.length; j++) {
                if (haystack[i + j] != needle[j]) continue outer;
            }
            return i;
        }
        return -1;
    }
}
