"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import api from "@/lib/api";
import type { Category, ItemType } from "@/lib/types";
import { useTranslations } from "next-intl";

/**
 * Listes en cascade Catégorie -> Sous-catégorie, bornées par un type.
 *
 * La classification se lit TYPE -> CATEGORIE -> SOUS-CATEGORIE -> ELEMENT. Le
 * type n'est pas choisi ici : il est imposé par ce que l'écran est en train de
 * créer — un produit, un service, un pack ou une offre — et ce composant n'expose
 * que les branches qui lui correspondent. C'est ce qui rend impossible de ranger
 * un routeur sous « Forfaits Data » depuis l'interface ; le serveur applique le
 * même refus de son côté, l'interface ne fait qu'éviter l'aller-retour.
 *
 * Seules les catégories actives sont proposées : une catégorie désactivée reste
 * lisible sur les fiches déjà classées mais ne doit plus en recevoir de nouvelles.
 *
 * `onChange` ne reçoit un identifiant que lorsque la sélection est complète. Si
 * la catégorie retenue possède des sous-catégories, la valeur reste vide tant
 * qu'aucune n'est choisie : un élément à demi classé est aussi introuvable qu'un
 * élément non classé.
 */
export default function CategoryPicker({
  type,
  value,
  onChange,
  disabled = false,
}: {
  type: ItemType;
  value: string;
  onChange: (categoryId: string) => void;
  disabled?: boolean;
}) {
  const t = useTranslations("classification");

  const [roots, setRoots] = useState<Category[]>([]);
  const [children, setChildren] = useState<Category[]>([]);
  const [rootId, setRootId] = useState("");
  const [loadingRoots, setLoadingRoots] = useState(true);
  const [loadingChildren, setLoadingChildren] = useState(false);

  // La valeur initiale d'une fiche en modification ne doit jamais etre effacee
  // par le remplissage des listes : seules les actions de l'utilisateur
  // remontent au formulaire.
  const hydrating = useRef(true);

  const childId = value && value !== rootId ? value : "";

  const loadChildren = useCallback(async (parentId: string) => {
    if (!parentId) {
      setChildren([]);
      return;
    }
    setLoadingChildren(true);
    try {
      const { data } = await api.get(`/categories/${parentId}/children`, {
        params: { activeOnly: true },
      });
      setChildren(data);
    } catch {
      setChildren([]);
    } finally {
      setLoadingChildren(false);
    }
  }, []);

  // Changement de type : on recharge les categories et on repart de zero si la
  // valeur courante n'appartient pas au nouveau type.
  useEffect(() => {
    let cancelled = false;
    hydrating.current = true;

    async function load() {
      setLoadingRoots(true);
      try {
        const { data } = await api.get("/categories", {
          params: { type, activeOnly: true },
        });
        if (cancelled) return;
        setRoots(data);

        if (!value) {
          setRootId("");
          setChildren([]);
          return;
        }

        // La fiche ne transporte que le noeud le plus profond : on remonte au
        // parent pour repositionner les deux listes.
        try {
          const { data: selected } = await api.get<Category>(`/categories/${value}`);
          if (cancelled) return;

          if (selected.type !== type) {
            // La categorie ne correspond plus au type : on la retire plutot que
            // de laisser un classement incoherent partir au serveur.
            setRootId("");
            setChildren([]);
            hydrating.current = false;
            onChange("");
            return;
          }

          const parentId = selected.parentId ?? selected.id;
          setRootId(parentId);
          await loadChildren(parentId);
        } catch {
          if (!cancelled) {
            setRootId("");
            setChildren([]);
          }
        }
      } catch {
        if (!cancelled) setRoots([]);
      } finally {
        if (!cancelled) {
          setLoadingRoots(false);
          hydrating.current = false;
        }
      }
    }

    load();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [type]);

  async function handleRootChange(nextRootId: string) {
    setRootId(nextRootId);
    setChildren([]);
    hydrating.current = false;

    if (!nextRootId) {
      onChange("");
      return;
    }

    // Tant que les sous-categories ne sont pas connues, la categorie racine fait
    // office de classement ; si elle en possede, la valeur est remise a vide et
    // la sous-categorie devient obligatoire.
    onChange(nextRootId);
    setLoadingChildren(true);
    try {
      const { data } = await api.get<Category[]>(`/categories/${nextRootId}/children`, {
        params: { activeOnly: true },
      });
      setChildren(data);
      if (data.length > 0) onChange("");
    } catch {
      setChildren([]);
    } finally {
      setLoadingChildren(false);
    }
  }

  function handleChildChange(nextChildId: string) {
    hydrating.current = false;
    onChange(nextChildId || "");
  }

  const noCategories = !loadingRoots && roots.length === 0;

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
      <div className="flex flex-col gap-1.5">
        <label className="text-[11px] font-semibold uppercase tracking-wider text-text-secondary dark:text-neutral-400">
          {t("category")} <span className="text-primary">*</span>
        </label>
        <select
          value={rootId}
          onChange={(e) => handleRootChange(e.target.value)}
          disabled={disabled || loadingRoots || noCategories}
          required
          className="input w-full h-10 disabled:opacity-60"
        >
          <option value="">{loadingRoots ? t("loading") : t("choose")}</option>
          {roots.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
        {noCategories && (
          <span className="text-[11px] text-amber-600 dark:text-amber-400">
            {t("noneForType")}
          </span>
        )}
      </div>

      <div className="flex flex-col gap-1.5">
        <label className="text-[11px] font-semibold uppercase tracking-wider text-text-secondary dark:text-neutral-400">
          {t("subCategory")}
          {children.length > 0 && <span className="text-primary"> *</span>}
        </label>
        <select
          value={childId}
          onChange={(e) => handleChildChange(e.target.value)}
          disabled={disabled || !rootId || loadingChildren || children.length === 0}
          required={children.length > 0}
          className="input w-full h-10 disabled:opacity-60"
        >
          <option value="">
            {loadingChildren
              ? t("loading")
              : children.length === 0
                ? t("noSubCategory")
                : t("choose")}
          </option>
          {children.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}
