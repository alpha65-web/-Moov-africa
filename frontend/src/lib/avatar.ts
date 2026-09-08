/** Cote maximal de l'avatar, en pixels. */
export const AVATAR_MAX_SIZE = 256;

/** Poids maximal du fichier choisi, avant redimensionnement. */
export const AVATAR_MAX_FILE_BYTES = 2 * 1024 * 1024;

/**
 * Redimensionne une image dans un canvas et renvoie une data URI JPEG.
 * Le backend refuse au-dela de 256 Ko encodes : 256x256 en qualite 0.8 tient
 * tres largement sous cette limite quel que soit le fichier d'origine.
 */
export function resizeToDataUrl(file: File, maxSize: number = AVATAR_MAX_SIZE): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("read"));
    reader.onload = () => {
      const image = new window.Image();
      image.onerror = () => reject(new Error("decode"));
      image.onload = () => {
        const scale = Math.min(1, maxSize / Math.max(image.width, image.height));
        const canvas = document.createElement("canvas");
        canvas.width = Math.round(image.width * scale);
        canvas.height = Math.round(image.height * scale);
        const ctx = canvas.getContext("2d");
        if (!ctx) { reject(new Error("canvas")); return; }
        ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL("image/jpeg", 0.8));
      };
      image.src = reader.result as string;
    };
    reader.readAsDataURL(file);
  });
}
