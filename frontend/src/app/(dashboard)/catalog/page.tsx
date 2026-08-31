"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import api, { apiError } from "@/lib/api";
import { searchKeyHandler } from "@/lib/search";
import { usePermissions, PERM } from "@/lib/permissions";
import type { CatalogItem, Category } from "@/lib/types";
import CategoryPicker from "@/components/CategoryPicker";
import ActionMenu from "@/components/ActionMenu";
import toast from "react-hot-toast";
import { useTranslations } from "next-intl";

type TabType = "PRODUCT" | "SERVICE" | "PACK";

const EMPTY_FORM = {
  name: "",
  description: "",
  basePrice: "",
  currency: "XOF",
  category: "",
  characteristics: "",
};

const PER_PAGE = 10;

const STATUS_STYLES: Record<string, string> = {
  ACTIVE: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400",
  DRAFT: "bg-neutral-100 text-neutral-600 dark:bg-neutral-800 dark:text-neutral-400",
  ARCHIVED: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
};

function Skeleton({ className }: { className: string }) {
  return <div className={`rounded-lg bg-neutral-100 dark:bg-neutral-800 animate-pulse ${className}`} />;
}

function TypeIcon({ type, className }: { type: TabType; className?: string }) {
  if (type === "PRODUCT") return (
    <svg className={className} viewBox="0 0 20 20" fill="none">
      <rect x="2" y="2" width="7" height="7" rx="1.5" stroke="currentColor" strokeWidth="1.5" />
      <rect x="11" y="2" width="7" height="7" rx="1.5" stroke="currentColor" strokeWidth="1.5" />
      <rect x="2" y="11" width="7" height="7" rx="1.5" stroke="currentColor" strokeWidth="1.5" />
      <rect x="11" y="11" width="7" height="7" rx="1.5" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  );
  if (type === "SERVICE") return (
    <svg className={className} viewBox="0 0 20 20" fill="none">
      <circle cx="10" cy="10" r="7" stroke="currentColor" strokeWidth="1.5" />
      <path d="M10 6v4l3 2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
  return (
    <svg className={className} viewBox="0 0 20 20" fill="none">
      <path d="M10 2l7 4v8l-7 4-7-4V6l7-4z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
      <path d="M10 10l7-4M10 10v8M10 10L3 6" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
    </svg>
  );
}

export default function CatalogPage() {
  const t = useTranslations("catalog");
  const tc = useTranslations("common");
  const tcat = useTranslations("categories");
  // Creation, modification et suppression du catalogue exigent CATALOG_MANAGE
  // (CatalogController). La simple lecture, ouverte a tous les roles metier,
  // donnait acces aux memes boutons : ils partaient en 403.
  const { has } = usePermissions();
  const canManage = has(PERM.CATALOG_MANAGE);

  /**
   * Doublons suspectes, en attente d'arbitrage.
   *
   * La detection (cahier des charges 7.2) n'existait pas : la table
   * duplicate_flags etait prevue mais rien ne l'alimentait ni ne la lisait. Un
   * meme terminal pouvait etre saisi deux fois sous deux libelles voisins sans
   * que rien ne le signale. Le rapprochement est volontairement non bloquant —
   * deux capacites d'un meme modele portent des noms proches et sont pourtant
   * bien deux produits — c'est donc au chef de produit de trancher.
   */
  const [duplicates, setDuplicates] = useState<{
    id: string;
    sourceProductName: string | null;
    duplicateProductName: string | null;
    similarityScore: number;
  }[]>([]);

  const loadDuplicates = useCallback(async () => {
    if (!canManage) return;
    try {
      const { data } = await api.get("/catalog/duplicates");
      setDuplicates(Array.isArray(data) ? data : []);
    } catch {
      // Rapprochements indisponibles : on n'affiche rien plutôt qu'un compte faux.
      setDuplicates([]);
    }
  }, [canManage]);

  useEffect(() => { loadDuplicates(); }, [loadDuplicates]);

  async function dismissDuplicate(flagId: string) {
    try {
      await api.patch(`/catalog/duplicates/${flagId}/resolve`);
      setDuplicates((current) => current.filter((flag) => flag.id !== flagId));
    } catch (e) {
      toast.error(apiError(e, tc("errors.action")));
    }
  }

  const [items, setItems] = useState<CatalogItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<TabType>("PRODUCT");
  const [search, setSearch] = useState("");
  const [filterCategory, setFilterCategory] = useState("");
  /**
   * Categories du type affiche, pour le filtre du tableau.
   *
   * L'ecran proposait huit libelles ecrits en dur — « Voix », « Data », « SMS »…
   * — sans rapport avec l'arborescence en base, et les envoyait dans un champ
   * qui attend un identifiant. Le filtre ne filtrait rien et la creation
   * echouait. La liste vient desormais du serveur, bornee au type de l'onglet.
   */
  const [filterOptions, setFilterOptions] = useState<Category[]>([]);
  const [page, setPage] = useState(1);

  const [showModal, setShowModal] = useState(false);
  const [creating, setCreating] = useState(false);
  const [editingItem, setEditingItem] = useState<CatalogItem | null>(null);
  const [form, setForm] = useState({ ...EMPTY_FORM });
  const modalRef = useRef<HTMLDivElement>(null);

  const [detailItem, setDetailItem] = useState<CatalogItem | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<CatalogItem | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [selectedPackItems, setSelectedPackItems] = useState<string[]>([]);
  const [packItemSearch, setPackItemSearch] = useState("");

  const isEditing = !!editingItem;

  useEffect(() => { loadItems(); }, []);

  useEffect(() => {
    function handleEscape(e: KeyboardEvent) {
      if (e.key === "Escape") {
        if (deleteTarget) { setDeleteTarget(null); return; }
        if (detailItem) { setDetailItem(null); return; }
        if (showModal) { setShowModal(false); resetForm(); }
      }
    }
    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [showModal, deleteTarget, detailItem]);

  useEffect(() => {
    function handleClickOutside() { if (openMenuId) setOpenMenuId(null); }
    document.addEventListener("click", handleClickOutside);
    return () => document.removeEventListener("click", handleClickOutside);
  }, [openMenuId]);

  useEffect(() => { setPage(1); }, [search, tab, filterCategory]);

  // Un changement de type rend le filtre courant caduc : les categories d'un
  // type ne sont jamais celles d'un autre.
  useEffect(() => {
    let cancelled = false;
    api.get("/categories", { params: { type: tab } })
      .then(async ({ data }: { data: Category[] }) => {
        const children = await Promise.all(
          data.map((root) =>
            api.get(`/categories/${root.id}/children`)
              .then((r) => r.data as Category[])
              .catch(() => [] as Category[])));
        if (!cancelled) setFilterOptions([...data, ...children.flat()]);
      })
      .catch(() => { if (!cancelled) setFilterOptions([]); });
    return () => { cancelled = true; };
  }, [tab]);

  async function loadItems() {
    try {
      // GET /catalog renvoie un Page<CatalogItemResponse>, pas un tableau nu.
      const { data } = await api.get("/catalog", { params: { size: 500 } });
      setItems(Array.isArray(data) ? data : data.content ?? []);
    } catch (e) { toast.error(apiError(e, tc("errors.load"))); }
    finally { setLoading(false); }
  }

  /**
   * Change de type affiche.
   *
   * Le filtre par categorie est remis a zero dans le meme geste : les categories
   * d'un type ne sont jamais celles d'un autre, et conserver l'ancienne selection
   * afficherait une liste vide sans explication.
   */
  function selectTab(next: TabType) {
    setTab(next);
    setFilterCategory("");
  }

  function resetForm() { setForm({ ...EMPTY_FORM }); setEditingItem(null); setSelectedPackItems([]); setPackItemSearch(""); }

  function openCreateModal() { resetForm(); setShowModal(true); }

  function openEditModal(item: CatalogItem) {
    setEditingItem(item);
    setForm({
      name: item.name,
      description: item.description || "",
      basePrice: item.basePrice?.toString() || "",
      currency: item.currency || "XOF",
      category: item.categoryId || "",
      characteristics: item.details ? JSON.stringify(item.details) : "",
    });
    setSelectedPackItems(Array.isArray(item.details?.items) ? (item.details.items as string[]) : []);
    setPackItemSearch("");
    setShowModal(true);
    setOpenMenuId(null);
  }

  function togglePackItem(id: string) {
    setSelectedPackItems((prev) => prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]);
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (creating) return;
    setCreating(true);
    try {
      const endpoint = tab === "PRODUCT" ? "/catalog/products" : tab === "SERVICE" ? "/catalog/services" : "/catalog/packs";
      const payload: Record<string, unknown> = {
        name: form.name, description: form.description,
        basePrice: parseFloat(form.basePrice) || 0, currency: form.currency,
        categoryId: form.category, characteristics: form.characteristics || "{}", packOnly: false,
      };
      if (tab === "SERVICE") { payload.serviceType = "DATA"; payload.billingCycle = "MONTHLY"; }
      if (tab === "PACK") { payload.bundlePrice = parseFloat(form.basePrice) || 0; payload.bundleDiscount = 0; payload.items = selectedPackItems; }

      if (isEditing) {
        const typeEndpoint = editingItem!.type === "PRODUCT" ? "products" : editingItem!.type === "SERVICE" ? "services" : "packs";
        await api.put(`/catalog/${typeEndpoint}/${editingItem!.id}`, payload);
        toast.success(t("messages.updated"));
      } else {
        await api.post(endpoint, payload);
        toast.success(t("messages.created"));
      }
      setShowModal(false); resetForm(); loadItems();
    } catch (e) {
      toast.error(apiError(e, isEditing ? tc("errors.update") : tc("errors.create")));
    } finally { setCreating(false); }
  }

  async function handleDelete() {
    if (!deleteTarget || deleting) return;
    setDeleting(true);
    try { await api.delete(`/catalog/${deleteTarget.id}`); toast.success(t("messages.deleted")); loadItems(); }
    catch (e) { toast.error(apiError(e, tc("errors.delete"))); }
    finally { setDeleting(false); setDeleteTarget(null); }
  }

  function formatPrice(price: number, currency: string) {
    return `${price.toLocaleString("fr-FR")} ${currency}`;
  }
  function formatDate(date: string) {
    return new Date(date).toLocaleDateString(undefined, { day: "2-digit", month: "short", year: "numeric" });
  }

  const tabKey = (tp: TabType) => tp === "PRODUCT" ? "products" : tp === "SERVICE" ? "services" : "packs";

  const filtered = items.filter((i) => {
    if (i.type !== tab) return false;
    if (search && !`${i.name} ${i.description}`.toLowerCase().includes(search.toLowerCase())) return false;
    if (filterCategory && i.categoryId !== filterCategory) return false;
    return true;
  });

  const totalPages = Math.ceil(filtered.length / PER_PAGE);
  const paginated = filtered.slice((page - 1) * PER_PAGE, page * PER_PAGE);

  const tabCounts = {
    PRODUCT: items.filter((i) => i.type === "PRODUCT").length,
    SERVICE: items.filter((i) => i.type === "SERVICE").length,
    PACK: items.filter((i) => i.type === "PACK").length,
  };

  const CARD_ACCENTS: Record<TabType, { icon: string; border: string }> = {
    PRODUCT: { icon: "text-primary bg-primary/10", border: tab === "PRODUCT" ? "border-primary ring-1 ring-primary/20" : "border-border dark:border-neutral-800" },
    SERVICE: { icon: "text-blue-600 dark:text-blue-400 bg-blue-500/10", border: tab === "SERVICE" ? "border-blue-500 ring-1 ring-blue-500/20" : "border-border dark:border-neutral-800" },
    PACK: { icon: "text-purple-600 dark:text-purple-400 bg-purple-500/10", border: tab === "PACK" ? "border-purple-500 ring-1 ring-purple-500/20" : "border-border dark:border-neutral-800" },
  };

  return (
    <div className="flex flex-col gap-6 pb-8">

      {/* ===== HEADER ===== */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-black dark:text-white">{t("title")}</h1>
          <p className="text-sm text-text-secondary dark:text-neutral-500 mt-1">{t("subtitle")}</p>
        </div>
        {canManage && (
        <button onClick={openCreateModal} className="primary-icon px-4 py-2.5 active-scale">
          <span className="flex items-center gap-2">
            <svg className="size-4" viewBox="0 0 16 16" fill="none">
              <path d="M8 3v10M3 8h10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
            <p className="text-sm font-medium">{t("newItem")}</p>
          </span>
        </button>
        )}
      </div>

      {/* ===== 3 CARDS COMPTEURS (Produits / Services / Packs) ===== */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {(["PRODUCT", "SERVICE", "PACK"] as TabType[]).map((tp) => (
          <button
            key={tp}
            onClick={() => selectTab(tp)}
            className={`rounded-2xl border bg-white dark:bg-neutral-900 p-5 shadow-card transition-all duration-200 hover:shadow-lg hover:-translate-y-0.5 text-left cursor-pointer ${CARD_ACCENTS[tp].border}`}
          >
            <div className="flex items-center gap-3 mb-3">
              <div className={`rounded-xl p-2.5 ${CARD_ACCENTS[tp].icon}`}>
                <TypeIcon type={tp} className="size-5" />
              </div>
              <span className="text-sm font-semibold text-black dark:text-white">{t(`tabs.${tabKey(tp)}`)}</span>
            </div>
            <div className="flex items-end justify-between">
              {loading ? (
                <Skeleton className="w-8 h-8" />
              ) : (
                <span className="text-3xl font-bold text-black dark:text-white tabular-nums">{tabCounts[tp]}</span>
              )}
              <span className={`text-xs font-medium flex items-center gap-1 ${tab === tp ? "text-primary" : "text-text-secondary dark:text-neutral-500"}`}>
                {t("viewAll")}
                <svg className="size-3" viewBox="0 0 12 12" fill="none">
                  <path d="M4.5 2.5l4 3.5-4 3.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </span>
            </div>
          </button>
        ))}
      </div>

      {/* ===== DOUBLONS SUSPECTÉS =====
          Détection exigée par la section 7.2 du cahier des charges. Elle
          n'existait pas : la table duplicate_flags était prévue depuis l'origine
          mais rien ne l'alimentait ni ne la lisait, et un même terminal pouvait
          être saisi deux fois sous deux libellés voisins sans que rien ne le
          signale.

          Volontairement non bloquant : deux capacités d'un même modèle portent
          des noms proches et sont pourtant bien deux produits distincts. Le
          système rapproche, le chef de produit tranche.
      */}
      {canManage && duplicates.length > 0 && (
        <div className="rounded-2xl border border-amber-300 dark:border-amber-800 bg-amber-50 dark:bg-amber-900/20 px-5 py-4">
          <div className="flex items-start gap-3">
            <span className="shrink-0 rounded-lg bg-amber-100 dark:bg-amber-900/40 p-2 text-amber-700 dark:text-amber-400">
              <svg className="size-4" viewBox="0 0 20 20" fill="none">
                <path d="M10 3l7 13H3l7-13z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
                <path d="M10 8v3.5M10 13.5v.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
            </span>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold text-amber-900 dark:text-amber-300">
                {t("duplicates.title", { count: duplicates.length })}
              </p>
              <p className="text-xs text-amber-800 dark:text-amber-400/90 mt-0.5">
                {t("duplicates.subtitle")}
              </p>
              <ul className="flex flex-col gap-1.5 mt-3">
                {duplicates.map((flag) => (
                  <li key={flag.id} className="flex flex-wrap items-center gap-2 text-xs">
                    <span className="font-medium text-black dark:text-white truncate">
                      {flag.sourceProductName ?? "—"}
                    </span>
                    <span className="text-amber-700 dark:text-amber-400" aria-hidden="true">↔</span>
                    <span className="font-medium text-black dark:text-white truncate">
                      {flag.duplicateProductName ?? "—"}
                    </span>
                    {/* Le taux est chiffré et libellé : la couleur ne le porte pas seule. */}
                    <span className="px-1.5 py-0.5 rounded bg-amber-100 dark:bg-amber-900/40 text-amber-800 dark:text-amber-300 font-semibold tabular-nums">
                      {t("duplicates.similarity", { percent: Math.round(flag.similarityScore * 100) })}
                    </span>
                    <button
                      onClick={() => dismissDuplicate(flag.id)}
                      className="text-amber-800 dark:text-amber-400 underline underline-offset-2 hover:no-underline cursor-pointer"
                    >
                      {t("duplicates.dismiss")}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      )}

      {/* ===== RECHERCHE + FILTRES ===== */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-neutral-400" viewBox="0 0 16 16" fill="none">
            <circle cx="7" cy="7" r="5" stroke="currentColor" strokeWidth="1.3" />
            <path d="M11 11l3.5 3.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
          </svg>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={searchKeyHandler(setSearch)}
            placeholder={tc("searchPlaceholder")}
            className="input w-full h-10 pl-9"
          />
        </div>
        <select
          value={filterCategory}
          onChange={(e) => setFilterCategory(e.target.value)}
          className="input h-10 min-w-[180px]"
        >
          <option value="">{tc("all")}</option>
          {filterOptions.map((c) => (
            <option key={c.id} value={c.id}>
              {c.parentName ? `${c.parentName} / ${c.name}` : c.name}
              {c.active ? "" : ` (${tcat("inactive")})`}
            </option>
          ))}
        </select>
      </div>

      {/* ===== TABLEAU ===== */}
      <div className="rounded-2xl border border-border dark:border-neutral-800 bg-white dark:bg-neutral-900 shadow-card overflow-hidden">
        {/* En-tête orange */}
        <div className="hidden md:grid grid-cols-[1fr_1.5fr_100px_110px_90px_60px] gap-4 px-6 py-3 bg-primary dark:bg-primary/90 rounded-t-2xl">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-white flex items-center gap-1">
            {t("columns.name")}
            <svg className="size-3 opacity-60" viewBox="0 0 12 12" fill="none"><path d="M6 3v6M3 7l3 3 3-3" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" /></svg>
          </span>
          <span className="text-[11px] font-semibold uppercase tracking-wider text-white flex items-center gap-1">
            {t("columns.description")}
            <svg className="size-3 opacity-60" viewBox="0 0 12 12" fill="none"><path d="M6 3v6M3 7l3 3 3-3" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" /></svg>
          </span>
          <span className="text-[11px] font-semibold uppercase tracking-wider text-white flex items-center gap-1">
            {t("columns.price")}
            <svg className="size-3 opacity-60" viewBox="0 0 12 12" fill="none"><path d="M6 3v6M3 7l3 3 3-3" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" /></svg>
          </span>
          <span className="text-[11px] font-semibold uppercase tracking-wider text-white flex items-center gap-1">
            {t("columns.category")}
            <svg className="size-3 opacity-60" viewBox="0 0 12 12" fill="none"><path d="M6 3v6M3 7l3 3 3-3" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" /></svg>
          </span>
          <span className="text-[11px] font-semibold uppercase tracking-wider text-white">{t("columns.status")}</span>
          <span className="text-[11px] font-semibold uppercase tracking-wider text-white text-right">{t("columns.actions")}</span>
        </div>

        {loading ? (
          <div className="px-6 py-4 flex flex-col gap-1">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="hidden md:grid grid-cols-[1fr_1.5fr_100px_110px_90px_60px] gap-4 items-center py-3.5">
                <Skeleton className="w-28 h-4" />
                <Skeleton className="w-44 h-4" />
                <Skeleton className="w-16 h-4" />
                <Skeleton className="w-14 h-4" />
                <Skeleton className="w-14 h-5 !rounded-md" />
                <Skeleton className="w-6 h-6 ml-auto" />
              </div>
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="px-6 py-20 text-center">
            <div className="flex flex-col items-center gap-4">
              <svg className="size-28" viewBox="0 0 120 120" fill="none">
                {/* Boîte ouverte */}
                <rect x="25" y="45" width="70" height="50" rx="6" className="fill-primary/10 dark:fill-primary/5 stroke-primary/30" strokeWidth="1.5" />
                <path d="M25 55h70" className="stroke-primary/20" strokeWidth="1" />
                {/* Rabats ouverts */}
                <path d="M25 45L35 28h50l10 17" className="fill-primary/15 dark:fill-primary/8 stroke-primary/40" strokeWidth="1.5" strokeLinejoin="round" />
                <path d="M60 28v17" className="stroke-primary/20" strokeWidth="1" strokeDasharray="3 2" />
                {/* Éléments sortant de la boîte */}
                <rect x="38" y="18" width="18" height="14" rx="3" className="fill-primary/20 stroke-primary/50" strokeWidth="1.2" />
                <rect x="64" y="22" width="18" height="14" rx="3" className="fill-amber-400/25 stroke-amber-500/50 dark:fill-amber-400/15 dark:stroke-amber-500/40" strokeWidth="1.2" />
                <rect x="48" y="8" width="24" height="16" rx="3" className="fill-blue-400/20 stroke-blue-500/40 dark:fill-blue-400/10 dark:stroke-blue-500/30" strokeWidth="1.2" />
                {/* Lignes dans les cartes */}
                <path d="M42 23h10M68 27h10M53 13h14M53 17h8" className="stroke-neutral-400/40" strokeWidth="1" strokeLinecap="round" />
                {/* Étoile décorative */}
                <circle cx="90" cy="30" r="3" className="fill-primary/30" />
                <circle cx="28" cy="35" r="2" className="fill-amber-400/30" />
                <circle cx="95" cy="50" r="1.5" className="fill-blue-400/30" />
              </svg>
              <div>
                <p className="text-sm font-semibold text-black dark:text-white">
                  {items.filter((i) => i.type === tab).length === 0 ? t("empty") : tc("noResults")}
                </p>
                {items.filter((i) => i.type === tab).length === 0 && (
                  <p className="text-xs text-text-secondary dark:text-neutral-500 mt-1">
                    {t("emptyHint")}
                  </p>
                )}
              </div>
              {canManage && items.filter((i) => i.type === tab).length === 0 && (
                <button onClick={openCreateModal} className="primary-icon px-4 py-2 active-scale mt-1">
                  <span className="flex items-center gap-2">
                    <svg className="size-4" viewBox="0 0 16 16" fill="none">
                      <path d="M8 3v10M3 8h10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                    </svg>
                    <p className="text-sm font-medium">{t("createFirst")}</p>
                  </span>
                </button>
              )}
            </div>
          </div>
        ) : (
          <div className="divide-y divide-border dark:divide-neutral-800">
            {paginated.map((item) => (
              <div
                key={item.id}
                className="grid grid-cols-1 md:grid-cols-[1fr_1.5fr_100px_110px_90px_60px] gap-2 md:gap-4 items-center px-6 py-3.5 hover:bg-neutral-50 dark:hover:bg-neutral-800/30 transition-colors cursor-pointer"
                onClick={() => setDetailItem(item)}
              >
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-black dark:text-white truncate">{item.name}</p>
                  {/* Auteur de la brique. Le cahier des charges (l. 114) donne au
                      chef de service la vue de « qui a cree quelle offre/produit ».
                      Le serveur ne renseigne ce nom que pour les roles qui ont a le
                      connaitre ; ailleurs il est nul et la ligne reste inchangee. */}
                  {item.createdByName && (
                    <p className="text-[11px] text-text-secondary dark:text-neutral-500 truncate">
                      {t("columns.createdBy", { name: item.createdByName })}
                    </p>
                  )}
                </div>
                <p className="text-xs text-text-secondary dark:text-neutral-500 truncate">{item.description || "—"}</p>
                <p className="text-sm font-semibold text-black dark:text-white tabular-nums">{formatPrice(item.basePrice, item.currency)}</p>
                <span className="text-xs text-text-secondary dark:text-neutral-400 truncate">
                  {item.categoryPath || "—"}
                </span>
                <span className={`inline-flex items-center w-fit px-2 py-0.5 text-[11px] font-semibold rounded-md ${STATUS_STYLES[item.status] ?? STATUS_STYLES.DRAFT}`}>
                  {t.has(`status.${item.status}`) ? t(`status.${item.status}`) : item.status}
                </span>
                <div className="flex justify-end relative" onClick={(e) => e.stopPropagation()}>
                  <button
                    onClick={() => setOpenMenuId(openMenuId === item.id ? null : item.id)}
                    className="p-1.5 rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
                  >
                    <svg className="size-5 text-neutral-500 dark:text-neutral-400" viewBox="0 0 16 16" fill="none">
                      <circle cx="8" cy="3" r="1.2" fill="currentColor" />
                      <circle cx="8" cy="8" r="1.2" fill="currentColor" />
                      <circle cx="8" cy="13" r="1.2" fill="currentColor" />
                    </svg>
                  </button>
                  <ActionMenu open={openMenuId === item.id} onClose={() => setOpenMenuId(null)} minWidth={140}>
                      <button
                        onClick={() => { setDetailItem(item); setOpenMenuId(null); }}
                        className="flex items-center gap-2 w-full px-3 py-2 text-sm text-black dark:text-white rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-700 transition-colors"
                      >
                        <svg className="size-4 text-neutral-500" viewBox="0 0 16 16" fill="none">
                          <circle cx="8" cy="8" r="6.5" stroke="currentColor" strokeWidth="1.5" />
                          <path d="M8 7v4M8 5.5v.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                        </svg>
                        {tc("status")}
                      </button>
                      {canManage && (
                        <>
                          <button
                            onClick={() => openEditModal(item)}
                            className="flex items-center gap-2 w-full px-3 py-2 text-sm text-black dark:text-white rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-700 transition-colors"
                          >
                            <svg className="size-4 text-neutral-500" viewBox="0 0 16 16" fill="none">
                              <path d="M11.5 1.5l3 3-9 9H2.5v-3l9-9z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
                            </svg>
                            {tc("edit")}
                          </button>
                          <button
                            onClick={() => { setDeleteTarget(item); setOpenMenuId(null); }}
                            className="flex items-center gap-2 w-full px-3 py-2 text-sm text-red-600 dark:text-red-400 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                          >
                            <svg className="size-4" viewBox="0 0 16 16" fill="none">
                              <path d="M3 4h10M6 4V3a1 1 0 011-1h2a1 1 0 011 1v1M5 4v9a1 1 0 001 1h4a1 1 0 001-1V4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                            </svg>
                            {tc("delete")}
                          </button>
                        </>
                      )}
                  </ActionMenu>
                </div>
              </div>
            ))}
          </div>
        )}

        {totalPages > 1 && (
          <div className="flex items-center justify-between px-6 py-3 border-t border-border dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-800/20">
            <span className="text-xs text-text-secondary dark:text-neutral-500">
              {(page - 1) * PER_PAGE + 1}–{Math.min(page * PER_PAGE, filtered.length)} / {filtered.length}
            </span>
            <div className="flex items-center gap-1">
              <button onClick={() => setPage(Math.max(1, page - 1))} disabled={page === 1} className="size-8 rounded-lg flex items-center justify-center border border-border dark:border-neutral-700 hover:bg-neutral-100 dark:hover:bg-neutral-700 transition-colors disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer">
                <svg className="size-3.5 text-neutral-600 dark:text-neutral-300" viewBox="0 0 12 12" fill="none"><path d="M7.5 2.5L4 6l3.5 3.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" /></svg>
              </button>
              {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
                <button key={p} onClick={() => setPage(p)} className={`size-8 rounded-lg flex items-center justify-center text-xs font-medium transition-colors cursor-pointer ${page === p ? "bg-primary text-white" : "border border-border dark:border-neutral-700 text-neutral-600 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-700"}`}>{p}</button>
              ))}
              <button onClick={() => setPage(Math.min(totalPages, page + 1))} disabled={page === totalPages} className="size-8 rounded-lg flex items-center justify-center border border-border dark:border-neutral-700 hover:bg-neutral-100 dark:hover:bg-neutral-700 transition-colors disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer">
                <svg className="size-3.5 text-neutral-600 dark:text-neutral-300" viewBox="0 0 12 12" fill="none"><path d="M4.5 2.5L8 6l-3.5 3.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" /></svg>
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ===== MODAL CRÉATION / ÉDITION ===== */}
      {showModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm px-4"
          onClick={(e) => { if (e.target === e.currentTarget) { setShowModal(false); resetForm(); } }}
        >
          <div ref={modalRef} className="bg-white dark:bg-neutral-900 border border-border dark:border-neutral-800 rounded-2xl shadow-xl w-full max-w-md overflow-hidden animate-fade-in">
            <div className="flex items-center justify-between px-6 py-4 border-b border-border dark:border-neutral-800">
              <h2 className="text-base font-bold text-black dark:text-white">
                {isEditing ? t("editTitle") : t("createTitle", { type: t(`tabs.${tabKey(tab)}`) })}
              </h2>
              <button onClick={() => { setShowModal(false); resetForm(); }} className="p-1.5 rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors cursor-pointer">
                <svg className="size-4 text-neutral-500" viewBox="0 0 16 16" fill="none">
                  <path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                </svg>
              </button>
            </div>
            <form onSubmit={handleCreate}>
              <div className="px-6 py-5 flex flex-col gap-4">
                <div className="flex flex-col gap-1.5">
                  <label className="text-[11px] font-semibold uppercase tracking-wider text-text-secondary dark:text-neutral-400">{t("form.name")}</label>
                  <input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="input w-full h-10" />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-[11px] font-semibold uppercase tracking-wider text-text-secondary dark:text-neutral-400">{t("form.description")}</label>
                  <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={3} className="input w-full resize-none" />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="flex flex-col gap-1.5">
                    <label className="text-[11px] font-semibold uppercase tracking-wider text-text-secondary dark:text-neutral-400">{t("form.price")}</label>
                    <input type="number" min="0" value={form.basePrice} onChange={(e) => setForm({ ...form, basePrice: e.target.value })} placeholder="0" className="input w-full h-10" />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label className="text-[11px] font-semibold uppercase tracking-wider text-text-secondary dark:text-neutral-400">{t("form.currency")}</label>
                    <select value={form.currency} onChange={(e) => setForm({ ...form, currency: e.target.value })} className="input w-full h-10">
                      <option value="XOF">XOF (FCFA)</option>
                      <option value="EUR">EUR</option>
                      <option value="USD">USD</option>
                    </select>
                  </div>
                </div>
                {/* Le type n'est pas un champ : c'est l'onglet courant. Les listes
                    ci-dessous ne proposent que les branches de ce type. */}
                <CategoryPicker
                  type={editingItem ? editingItem.type : tab}
                  value={form.category}
                  onChange={(categoryId) => setForm((f) => ({ ...f, category: categoryId }))}
                />

                {tab === "PACK" && (
                  <div className="flex flex-col gap-2">
                    <div className="flex items-center justify-between">
                      <label className="text-[11px] font-semibold uppercase tracking-wider text-text-secondary dark:text-neutral-400">
                        {t("form.packItems")}
                      </label>
                      {selectedPackItems.length > 0 && (
                        <span className="text-[11px] font-medium text-primary tabular-nums">
                          {selectedPackItems.length} {t("form.selected")}
                        </span>
                      )}
                    </div>
                    {selectedPackItems.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 p-2 rounded-xl border border-border dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-800/30">
                        {selectedPackItems.map((id) => {
                          const item = items.find((i) => i.id === id);
                          if (!item) return null;
                          return (
                            <span key={id} className="inline-flex items-center gap-1.5 pl-2.5 pr-1.5 py-1 rounded-lg bg-primary/10 text-primary text-xs font-medium">
                              {item.name}
                              <button type="button" onClick={() => togglePackItem(id)} className="size-4 rounded-full hover:bg-primary/20 flex items-center justify-center transition-colors cursor-pointer">
                                <svg className="size-2.5" viewBox="0 0 10 10" fill="none"><path d="M2.5 2.5l5 5M7.5 2.5l-5 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" /></svg>
                              </button>
                            </span>
                          );
                        })}
                      </div>
                    )}
                    <div className="relative">
                      <svg className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-neutral-400" viewBox="0 0 16 16" fill="none">
                        <circle cx="7" cy="7" r="5" stroke="currentColor" strokeWidth="1.3" />
                        <path d="M11 11l3.5 3.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
                      </svg>
                      <input
                        value={packItemSearch}
                        onChange={(e) => setPackItemSearch(e.target.value)}
                        onKeyDown={searchKeyHandler(setPackItemSearch)}
                        placeholder={tc("searchPlaceholder")}
                        className="input w-full h-9 pl-8 text-xs"
                      />
                    </div>
                    <div className="border border-border dark:border-neutral-800 rounded-xl max-h-40 overflow-y-auto">
                      {items
                        .filter((i) => i.type === "PRODUCT" || i.type === "SERVICE")
                        .filter((i) => !packItemSearch || i.name.toLowerCase().includes(packItemSearch.toLowerCase()))
                        .length === 0 ? (
                        <p className="text-xs text-text-secondary dark:text-neutral-500 text-center py-4">
                          {t("form.noItems")}
                        </p>
                      ) : (
                        items
                          .filter((i) => i.type === "PRODUCT" || i.type === "SERVICE")
                          .filter((i) => !packItemSearch || i.name.toLowerCase().includes(packItemSearch.toLowerCase()))
                          .map((i) => (
                            <label
                              key={i.id}
                              className="flex items-center gap-3 px-3 py-2.5 hover:bg-neutral-50 dark:hover:bg-neutral-800/50 transition-colors cursor-pointer border-b border-border dark:border-neutral-800 last:border-b-0"
                            >
                              <input
                                type="checkbox"
                                checked={selectedPackItems.includes(i.id)}
                                onChange={() => togglePackItem(i.id)}
                                className="size-4 rounded border-neutral-300 text-primary accent-primary cursor-pointer"
                              />
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium text-black dark:text-white truncate">{i.name}</p>
                                <p className="text-[11px] text-text-secondary dark:text-neutral-500">
                                  {t(`tabs.${i.type === "PRODUCT" ? "products" : "services"}`)} · {formatPrice(i.basePrice, i.currency)}
                                </p>
                              </div>
                              <TypeIcon type={i.type} className="size-4 text-neutral-400 shrink-0" />
                            </label>
                          ))
                      )}
                    </div>
                  </div>
                )}
              </div>
              <div className="flex items-center justify-end gap-2 px-6 py-4 border-t border-border dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-800/30">
                <button type="button" onClick={() => { setShowModal(false); resetForm(); }} className="tertiary-icon px-4 py-2 active-scale">
                  <p className="text-sm font-medium">{tc("cancel")}</p>
                </button>
                <button type="submit" disabled={creating} className="primary-icon px-5 py-2 active-scale disabled:opacity-60">
                  <span className="flex items-center gap-2">
                    {creating && <div className="size-4 animate-spin rounded-full border-2 border-white border-t-transparent" />}
                    <p className="text-sm font-medium">{creating ? tc("saving") : tc("save")}</p>
                  </span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ===== MODAL DÉTAIL ===== */}
      {detailItem && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm px-4"
          onClick={(e) => { if (e.target === e.currentTarget) setDetailItem(null); }}
        >
          <div className="bg-white dark:bg-neutral-900 border border-border dark:border-neutral-800 rounded-2xl shadow-xl w-full max-w-md overflow-hidden animate-fade-in">
            <div className="flex items-center justify-between px-6 py-4 border-b border-border dark:border-neutral-800">
              <div className="flex items-center gap-3">
                <div className="size-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
                  <TypeIcon type={detailItem.type} className="size-5" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-black dark:text-white">{detailItem.name}</h2>
                  <p className="text-xs text-text-secondary dark:text-neutral-500">{t(`tabs.${tabKey(detailItem.type)}`)}</p>
                </div>
              </div>
              <button onClick={() => setDetailItem(null)} className="p-1.5 rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors cursor-pointer">
                <svg className="size-4 text-neutral-500" viewBox="0 0 16 16" fill="none">
                  <path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                </svg>
              </button>
            </div>
            <div className="px-6 py-5 flex flex-col gap-5">
              <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col gap-1">
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-text-secondary dark:text-neutral-500">{t("columns.price")}</p>
                  <p className="text-sm font-bold text-black dark:text-white">{formatPrice(detailItem.basePrice, detailItem.currency)}</p>
                </div>
                <div className="flex flex-col gap-1">
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-text-secondary dark:text-neutral-500">{t("columns.status")}</p>
                  <span className={`inline-flex items-center w-fit px-2 py-0.5 text-[11px] font-semibold rounded-md ${STATUS_STYLES[detailItem.status] ?? STATUS_STYLES.DRAFT}`}>
                    {t.has(`status.${detailItem.status}`) ? t(`status.${detailItem.status}`) : detailItem.status}
                  </span>
                </div>
                <div className="flex flex-col gap-1">
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-text-secondary dark:text-neutral-500">{t("columns.category")}</p>
                  <p className="text-sm font-medium text-black dark:text-white">
                    {detailItem.categoryPath || "—"}
                  </p>
                </div>
                <div className="flex flex-col gap-1">
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-text-secondary dark:text-neutral-500">{tc("date")}</p>
                  <p className="text-sm font-medium text-black dark:text-white">{formatDate(detailItem.createdAt)}</p>
                </div>
              </div>
              {detailItem.description && (
                <div className="flex flex-col gap-1">
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-text-secondary dark:text-neutral-500">{t("columns.description")}</p>
                  <p className="text-sm text-black dark:text-white leading-relaxed">{detailItem.description}</p>
                </div>
              )}
            </div>
            <div className="flex items-center justify-end gap-2 px-6 py-4 border-t border-border dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-800/30">
              <button onClick={() => { openEditModal(detailItem); setDetailItem(null); }} className="secondary-icon px-4 py-2 active-scale">
                <span className="flex items-center gap-1.5">
                  <svg className="size-3.5" viewBox="0 0 16 16" fill="none">
                    <path d="M11.5 1.5l3 3-9 9H2.5v-3l9-9z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" />
                  </svg>
                  <p className="text-sm font-medium">{tc("edit")}</p>
                </span>
              </button>
              <button onClick={() => setDetailItem(null)} className="tertiary-icon px-4 py-2 active-scale">
                <p className="text-sm font-medium">{tc("close")}</p>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ===== MODAL SUPPRESSION ===== */}
      {deleteTarget && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm px-4"
          onClick={(e) => { if (e.target === e.currentTarget) setDeleteTarget(null); }}
        >
          <div className="bg-white dark:bg-neutral-900 border border-border dark:border-neutral-800 rounded-2xl shadow-xl w-full max-w-sm overflow-hidden animate-fade-in">
            <div className="px-6 py-6 flex flex-col items-center gap-4 text-center">
              <div className="size-14 rounded-2xl bg-red-50 dark:bg-red-900/20 flex items-center justify-center">
                <svg className="size-7 text-red-600 dark:text-red-400" viewBox="0 0 16 16" fill="none">
                  <path d="M3 4h10M6 4V3a1 1 0 011-1h2a1 1 0 011 1v1M5 4v9a1 1 0 001 1h4a1 1 0 001-1V4" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </div>
              <div>
                <p className="text-sm font-bold text-black dark:text-white">{t("messages.deleteConfirm")}</p>
                <p className="text-xs text-text-secondary dark:text-neutral-500 mt-1.5">
                  <span className="font-semibold text-black dark:text-white">{deleteTarget.name}</span> — {t("messages.deleteWarning")}
                </p>
              </div>
            </div>
            <div className="flex items-center justify-center gap-2 px-6 py-4 border-t border-border dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-800/30">
              <button onClick={() => setDeleteTarget(null)} className="tertiary-icon px-4 py-2 active-scale">
                <p className="text-sm font-medium">{tc("cancel")}</p>
              </button>
              <button onClick={handleDelete} disabled={deleting} className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white text-sm font-medium active-scale disabled:opacity-60 transition-colors cursor-pointer rounded-lg">
                {deleting ? tc("deleting") : tc("delete")}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
