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
 * Deux régimes, et la distinction est délibérée :
 *
 * — **vignette** (défaut), pour les grilles et les galeries. Seules les images
 *   sont téléchargées. Une vidéo ou un PDF y reçoit une icône propre à sa
 *   famille : télécharger cinquante mégaoctets de vidéo pour illustrer une
 *   case de grille coûterait la bande passante de toute la médiathèque à
 *   chaque affichage.
 *
 * — **complet** (`playable`), pour la fiche d'un média. La vidéo s'y lit avec
 *   ses commandes et le PDF s'y feuillette. Le cahier des charges (7.6) demande
 *   au chef de service de juger « le format, la résolution et les droits
 *   d'auteur » avec une « annotation détaillée selon le type de média (image,
 *   vidéo, PDF) » : il approuvait jusqu'ici des vidéos et des notices qu'aucun
 *   écran ne lui montrait, les deux se réduisant à la même icône grise.
 */
export default function MediaPreview({
  mediaId,
  mimeType,
  fileName,
  className = "",
  playable = false,
}: {
  mediaId: string;
  mimeType: string;
  fileName: string;
  className?: string;
  /** Lit la vidéo et feuillette le PDF au lieu d'en montrer l'icône. */
  playable?: boolean;
}) {
  const isImage = mimeType?.startsWith("image/");
  const isVideo = mimeType?.startsWith("video/");
  const isPdf = mimeType === "application/pdf";

  // Le binaire n'est demandé que s'il sera réellement affiché.
  const needsContent = isImage || (playable && (isVideo || isPdf));

  const [url, setUrl] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!needsContent) return;
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
  }, [mediaId, needsContent]);

  const frame = `relative flex items-center justify-center overflow-hidden rounded-lg bg-neutral-100 dark:bg-neutral-800 ${className}`;

  if (failed) {
    return (
      <div className={frame} title={fileName}>
        <svg className="w-1/2 max-w-8 text-red-400" viewBox="0 0 24 24" fill="none">
          <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.5" />
          <path d="M12 7.5v5M12 15.5v.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
      </div>
    );
  }

  if (needsContent && !url) {
    return <div className={`${frame} animate-pulse`} />;
  }

  if (isImage) {
    return (
      <div className={frame}>
        {/* Une URL d'objet local ne passe pas par l'optimiseur de next/image. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={url!} alt={fileName} className="max-w-full max-h-full object-contain" />
      </div>
    );
  }

  if (isVideo) {
    // En vignette, la video se reduit a sa famille : une pellicule et le bouton
    // de lecture disent qu'il y a quelque chose a lire, la ou l'icone de
    // document generique laissait croire a un fichier joint quelconque.
    return playable ? (
      <div className={frame}>
        <video src={url!} controls className="max-w-full max-h-full" />
      </div>
    ) : (
      <div className={frame} title={fileName}>
        <svg className="w-1/2 max-w-10 text-neutral-400" viewBox="0 0 24 24" fill="none">
          <rect x="2.5" y="5" width="19" height="14" rx="2" stroke="currentColor" strokeWidth="1.5" />
          <path d="M2.5 9h19M2.5 15h19M7 5v4M7 15v4M17 5v4M17 15v4" stroke="currentColor" strokeWidth="1.2" />
        </svg>
        <span className="absolute inset-0 flex items-center justify-center">
          <span className="flex items-center justify-center size-8 rounded-full bg-black/55 text-white">
            <svg className="size-3.5 ml-0.5" viewBox="0 0 12 12" fill="currentColor"><path d="M3 2l7 4-7 4V2z" /></svg>
          </span>
        </span>
      </div>
    );
  }

  if (isPdf) {
    return playable ? (
      // Le cadre porte la bordure passée par l'appelant : en imposer une ici
      // entrerait en conflit avec elle sans qu'on sache laquelle l'emporte.
      <iframe src={url!} title={fileName} className={`rounded-lg bg-white ${className}`} />
    ) : (
      <div className={frame} title={fileName}>
        <svg className="w-1/2 max-w-8 text-red-400" viewBox="0 0 24 24" fill="none">
          <path d="M14 3H7a2 2 0 00-2 2v14a2 2 0 002 2h10a2 2 0 002-2V8l-5-5z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
          <path d="M14 3v5h5" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
        </svg>
        <span className="absolute bottom-1 right-1 px-1.5 py-0.5 rounded bg-red-500 text-white text-[9px] font-bold tracking-wide">PDF</span>
      </div>
    );
  }

  // Tout autre format : le fichier existe, il n'est simplement pas prévisualisable.
  return (
    <div className={frame} title={fileName}>
      <svg className="w-1/2 max-w-8 text-neutral-400" viewBox="0 0 24 24" fill="none">
        <path d="M14 3H7a2 2 0 00-2 2v14a2 2 0 002 2h10a2 2 0 002-2V8l-5-5z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
        <path d="M14 3v5h5" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
      </svg>
    </div>
  );
}
