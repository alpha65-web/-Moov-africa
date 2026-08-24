"use client";

import { useEffect, useState } from "react";
import api from "@/lib/api";

/**
 * Affiche le contenu réel d'un média.
 *
 * L'endpoint /media/{id}/content exige le jeton d'authentification : une balise
 * <img src="..."> ne peut pas le transmettre. Le fichier est donc récupéré par le
 * client API, puis exposé au navigateur sous forme d'URL d'objet, libérée au
 * démontage pour ne pas retenir le binaire en mémoire.
 *
 * Les formats non affichables (PDF, vidéo) reçoivent une icône explicite plutôt
 * qu'un cadre vide : le fichier existe, il n'est simplement pas prévisualisable ici.
 */
export default function MediaPreview({
  mediaId,
  mimeType,
  fileName,
  className = "",
}: {
  mediaId: string;
  mimeType: string;
  fileName: string;
  className?: string;
}) {
  const isImage = mimeType?.startsWith("image/");
  const [url, setUrl] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!isImage) return;
    let objectUrl: string | null = null;
    let cancelled = false;

    (async () => {
      try {
        const { data } = await api.get(`/media/${mediaId}/content`, { responseType: "blob" });
        if (cancelled) return;
        objectUrl = URL.createObjectURL(data as Blob);
        setUrl(objectUrl);
      } catch {
        // Fichier absent du stockage ou stockage injoignable : on le dit par un
        // repere visuel plutot que de laisser un cadre indefiniment vide.
        if (!cancelled) setFailed(true);
      }
    })();

    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [mediaId, isImage]);

  const frame = `flex items-center justify-center overflow-hidden rounded-lg bg-neutral-100 dark:bg-neutral-800 ${className}`;

  if (!isImage) {
    return (
      <div className={frame} title={fileName}>
        <svg className="size-1/2 max-size-8 text-neutral-400" viewBox="0 0 24 24" fill="none">
          <path d="M14 3H7a2 2 0 00-2 2v14a2 2 0 002 2h10a2 2 0 002-2V8l-5-5z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
          <path d="M14 3v5h5" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
        </svg>
      </div>
    );
  }

  if (failed) {
    return (
      <div className={frame} title={fileName}>
        <svg className="size-1/2 text-red-400" viewBox="0 0 24 24" fill="none">
          <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.5" />
          <path d="M12 7.5v5M12 15.5v.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
      </div>
    );
  }

  if (!url) {
    return <div className={`${frame} animate-pulse`} />;
  }

  return (
    <div className={frame}>
      {/* Une URL d'objet local ne passe pas par l'optimiseur de next/image. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={url} alt={fileName} className="max-w-full max-h-full object-contain" />
    </div>
  );
}
