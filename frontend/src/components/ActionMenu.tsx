"use client";

import { ReactNode, useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

/**
 * Menu d'actions d'une ligne de liste, affiche hors du flux de la page.
 *
 * Le menu etait jusqu'ici un bloc `absolute` pose dans la ligne. Or toutes les
 * listes de la plateforme sont enfermees dans une carte `overflow-hidden`, qui
 * arrondit leurs coins : dessine a l'interieur, le menu se faisait couper des
 * qu'il depassait le bas de la carte. Le defaut se voyait surtout sur les listes
 * courtes — avec deux lignes, la carte s'arrete quelques pixels sous la seconde,
 * et le menu de cette ligne n'apparaissait qu'a moitie.
 *
 * Le menu est donc rendu dans un portail attache au corps du document, ou aucune
 * carte ne peut le rogner, et positionne a la main en face de son declencheur.
 * Il s'ouvre vers le bas, bascule vers le haut quand la fenetre manque de place,
 * et reste borne a l'ecran dans les deux sens : un menu place hors du champ
 * visible serait un menu perdu.
 *
 * Le declencheur reste a la charge de l'appelant — les boutons different d'un
 * ecran a l'autre, notamment sur la mediatheque ou il se pose sur la vignette.
 * Le composant se contente de mesurer l'element qui l'entoure, c'est-a-dire le
 * conteneur du declencheur.
 */

/** Marge conservee entre le menu et le bord de la fenetre. */
const VIEWPORT_MARGIN = 8;

/** Ecart entre le declencheur et le menu, identique a l'ancien `mt-1`. */
const TRIGGER_GAP = 4;

interface ActionMenuProps {
  open: boolean;
  /** Ferme le menu : appele lorsqu'un defilement ou un redimensionnement le desancre. */
  onClose: () => void;
  /** Largeur minimale, comme l'ancien `min-w-[...]` de chaque ecran. */
  minWidth?: number;
  children: ReactNode;
}

export default function ActionMenu({ open, onClose, minWidth = 160, children }: ActionMenuProps) {
  const anchorRef = useRef<HTMLSpanElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState<{ top: number; left: number } | null>(null);

  // useLayoutEffect et non useEffect : la mesure a lieu avant le trace, sinon le
  // menu apparaitrait une image en haut a gauche avant de rejoindre sa place.
  useLayoutEffect(() => {
    // A la fermeture, la derniere position est conservee plutot que remise a
    // zero : la remise a zero serait un rendu de plus pour rien, et la position
    // conservee ne se voit jamais puisque l'effet la recalcule a la reouverture,
    // avant que le navigateur ne trace quoi que ce soit.
    if (!open) return;
    const trigger = anchorRef.current?.parentElement;
    const panel = panelRef.current;
    if (!trigger || !panel) return;

    const anchor = trigger.getBoundingClientRect();
    const width = Math.max(panel.offsetWidth, minWidth);
    const height = panel.offsetHeight;

    let top = anchor.bottom + TRIGGER_GAP;
    if (top + height > window.innerHeight - VIEWPORT_MARGIN) {
      const above = anchor.top - TRIGGER_GAP - height;
      // Au-dessus si la place y est ; sinon plaque au bas de la fenetre, ou le
      // menu reste entier plutot que tronque.
      top = above >= VIEWPORT_MARGIN
        ? above
        : Math.max(VIEWPORT_MARGIN, window.innerHeight - VIEWPORT_MARGIN - height);
    }

    // Aligne a droite du declencheur, comme l'ancien `right-0`.
    const left = Math.min(
      Math.max(VIEWPORT_MARGIN, anchor.right - width),
      Math.max(VIEWPORT_MARGIN, window.innerWidth - VIEWPORT_MARGIN - width),
    );

    // La comparaison n'est pas une optimisation : poser un objet neuf a chaque
    // passage relancerait le rendu, donc l'effet, sans fin.
    setPosition((previous) =>
      previous && previous.top === top && previous.left === left ? previous : { top, left });
  }, [open, minWidth]);

  // Un menu en position fixe ne suit pas la page : au moindre defilement il se
  // retrouverait a cote de sa ligne. Il se ferme plutot que de mentir sur ce a
  // quoi il se rapporte.
  useEffect(() => {
    if (!open) return;
    function dismiss() { onClose(); }
    window.addEventListener("scroll", dismiss, true);
    window.addEventListener("resize", dismiss);
    return () => {
      window.removeEventListener("scroll", dismiss, true);
      window.removeEventListener("resize", dismiss);
    };
  }, [open, onClose]);

  return (
    <span ref={anchorRef} className="contents">
      {open && typeof document !== "undefined" && createPortal(
        <div
          ref={panelRef}
          role="menu"
          style={{
            position: "fixed",
            top: position?.top ?? 0,
            left: position?.left ?? 0,
            minWidth,
            // Invisible le temps de la mesure, sans quoi le menu clignoterait
            // en haut a gauche de l'ecran avant d'etre place.
            visibility: position ? "visible" : "hidden",
          }}
          className="z-40 bg-white dark:bg-neutral-800 border border-border dark:border-neutral-700 rounded-xl shadow-lg p-1 animate-fade-in"
        >
          {children}
        </div>,
        document.body,
      )}
    </span>
  );
}
