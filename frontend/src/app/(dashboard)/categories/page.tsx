"use client";

import { useEffect, useState } from "react";
import api, { apiError } from "@/lib/api";
import { searchKeyHandler } from "@/lib/search";
import { usePermissions, PERM } from "@/lib/permissions";
import type { Category, ItemType } from "@/lib/types";
import toast from "react-hot-toast";
import { useTranslations } from "next-intl";
import { accentBar } from "@/lib/accent";
import ActionMenu from "@/components/ActionMenu";

const EMPTY_FORM = { name: "", description: "", type: "", parentId: "" };

/**
 * Couleur par type de classification.
 *
 * Le tableau distinguait les niveaux (racine / sous-catégorie), une information
 * de structure. Ce qui manquait était la nature de la branche : c'est le type qui
 * décide quels éléments peuvent s'y ranger.
 */
const TYPE_STYLES: Record<ItemType, string> = {
  PRODUCT: "bg-primary/10 text-primary",
  OFFER: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
  SERVICE: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400",
  PACK: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400",
};

const TYPES: ItemType[] = ["PRODUCT", "OFFER", "SERVICE", "PACK"];

function Skeleton({ className }: { className: string }) {
  return <div className={`rounded-lg bg-neutral-100 dark:bg-neutral-800 animate-pulse ${className}`} />;
}

const PER_PAGE = 10;

export default function CategoriesPage() {
  const t = useTranslations("categories");
  const tc = useTranslations("common");
  const tclass = useTranslations("classification");
  // CategoryController exige CATALOG_MANAGE en creation, modification et
  // suppression ; la lecture seule reste ouverte a tous les roles metier.
  const { has } = usePermissions();
  const canManage = has(PERM.CATALOG_MANAGE);

  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterType, setFilterType] = useState("");
  const [filterStatus, setFilterStatus] = useState("");

  const [showModal, setShowModal] = useState(false);
  const [creating, setCreating] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [form, setForm] = useState({ ...EMPTY_FORM });

  const [deleteTarget, setDeleteTarget] = useState<Category | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [page, setPage] = useState(1);

  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [childrenMap, setChildrenMap] = useState<Record<string, Category[]>>({});
  const [loadingChildren, setLoadingChildren] = useState<Set<string>>(new Set());

  const isEditing = !!editingCategory;

  useEffect(() => { loadCategories(); }, []);

  useEffect(() => {
    function handleEscape(e: KeyboardEvent) {
      if (e.key === "Escape") {
        if (deleteTarget) { setDeleteTarget(null); return; }
        if (showModal) { setShowModal(false); resetForm(); }
      }
    }
    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [showModal, deleteTarget]);

  useEffect(() => {
    function handleClickOutside() { if (openMenuId) setOpenMenuId(null); }
    document.addEventListener("click", handleClickOutside);
    return () => document.removeEventListener("click", handleClickOutside);
  }, [openMenuId]);

  useEffect(() => { setPage(1); }, [search, filterType, filterStatus]);

  async function loadCategories() {
    try { const { data } = await api.get("/categories"); setCategories(data); }
    catch (e) { toast.error(apiError(e, tc("errors.load"))); }
    finally { setLoading(false); }
  }

  async function loadChildren(parentId: string) {
    if (childrenMap[parentId]) return;
    setLoadingChildren((prev) => new Set(prev).add(parentId));
    try {
      const { data } = await api.get(`/categories/${parentId}/children`);
      setChildrenMap((prev) => ({ ...prev, [parentId]: data }));
    } catch { setChildrenMap((prev) => ({ ...prev, [parentId]: [] })); }
    finally { setLoadingChildren((prev) => { const n = new Set(prev); n.delete(parentId); return n; }); }
  }

  function toggleExpand(id: string) {
    setExpandedIds((prev) => {
      const n = new Set(prev);
      if (n.has(id)) { n.delete(id); } else { n.add(id); loadChildren(id); }
      return n;
    });
  }

  function resetForm() { setForm({ ...EMPTY_FORM }); setEditingCategory(null); }
  function openCreateModal() { resetForm(); setShowModal(true); }

  function openEditModal(cat: Category) {
    setEditingCategory(cat);
    setForm({
      name: cat.name,
      description: cat.description || "",
      type: cat.type,
      parentId: cat.parentId || "",
    });
    setShowModal(true);
    setOpenMenuId(null);
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (creating) return;
    setCreating(true);
    try {
      // Le type n'accompagne que la création d'une racine : une sous-catégorie
      // hérite de celui de son parent, et le serveur refuse une valeur qui le
      // contredirait plutôt que de l'écraser en silence.
      const payload = {
        name: form.name,
        description: form.description || null,
        type: form.parentId ? null : form.type,
        parentId: form.parentId || null,
      };
      if (isEditing) {
        await api.put(`/categories/${editingCategory!.id}`, payload);
        toast.success(t("messages.updated"));
      } else {
        await api.post("/categories", payload);
        toast.success(t("messages.created"));
      }
      setShowModal(false); resetForm(); loadCategories();
    } catch (e) {
      toast.error(apiError(e, isEditing ? tc("errors.update") : tc("errors.create")));
    } finally { setCreating(false); }
  }

  const [togglingId, setTogglingId] = useState<string | null>(null);

  /**
   * Bascule la mise en service d'une catégorie.
   *
   * Remplace la suppression dès qu'une catégorie a servi : désactiver la retire
   * des listes de classement sans détacher les éléments qui la référencent, et le
   * geste reste réversible. Le serveur propage la désactivation aux
   * sous-catégories — une sous-catégorie active sous une catégorie hors service
   * ne serait jamais atteignable.
   */
  async function toggleActive(cat: Category) {
    if (togglingId) return;
    setTogglingId(cat.id);
    setOpenMenuId(null);
    try {
      await api.patch(`/categories/${cat.id}/${cat.active ? "deactivate" : "reactivate"}`);
      toast.success(t(cat.active ? "messages.deactivated" : "messages.reactivated"));
      setChildrenMap({});
      loadCategories();
    } catch (e) {
      toast.error(apiError(e, tc("errors.action")));
    } finally {
      setTogglingId(null);
    }
  }

  async function handleDelete() {
    if (!deleteTarget || deleting) return;
    setDeleting(true);
    try { await api.delete(`/categories/${deleteTarget.id}`); toast.success(t("messages.deleted")); loadCategories(); }
    catch (e) { toast.error(apiError(e, tc("errors.delete"))); }
    finally { setDeleting(false); setDeleteTarget(null); }
  }

  function parentName(parentId: string | null): string {
    if (!parentId) return "—";
    const p = categories.find((c) => c.id === parentId);
    return p?.name ?? parentId.slice(0, 8) + "...";
  }

  const filtered = categories.filter((c) => {
    if (search && !c.name.toLowerCase().includes(search.toLowerCase()) && !c.description.toLowerCase().includes(search.toLowerCase())) return false;
    if (filterType && c.type !== filterType) return false;
    if (filterStatus === "ACTIVE" && !c.active) return false;
    if (filterStatus === "INACTIVE" && c.active) return false;
    return true;
  });

  const totalPages = Math.ceil(filtered.length / PER_PAGE);
  const paginated = filtered.slice((page - 1) * PER_PAGE, page * PER_PAGE);


  const stats = {
    total: categories.length,
    types: new Set(categories.map((c) => c.type)).size,
    inactive: categories.filter((c) => !c.active).length,
  };

  const cardData = [
    { key: "total", count: stats.total, label: t("stats.total"), color: "text-blue-600 dark:text-blue-400", bg: "bg-blue-100 dark:bg-blue-900/30", icon: (
      <svg className="size-6" viewBox="0 0 24 24" fill="none"><rect x="3" y="3" width="7" height="7" rx="1.5" stroke="currentColor" strokeWidth="1.5" /><rect x="14" y="3" width="7" height="7" rx="1.5" stroke="currentColor" strokeWidth="1.5" /><rect x="3" y="14" width="7" height="7" rx="1.5" stroke="currentColor" strokeWidth="1.5" /><rect x="14" y="14" width="7" height="7" rx="1.5" stroke="currentColor" strokeWidth="1.5" /></svg>
    ) },
    { key: "types", count: stats.types, label: t("stats.types"), color: "text-emerald-600 dark:text-emerald-400", bg: "bg-emerald-100 dark:bg-emerald-900/30", icon: (
      <svg className="size-6" viewBox="0 0 24 24" fill="none"><path d="M12 3v18M5 8h14M5 16h14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" /></svg>
    ) },
    { key: "inactive", count: stats.inactive, label: t("stats.inactive"), color: "text-purple-600 dark:text-purple-400", bg: "bg-purple-100 dark:bg-purple-900/30", icon: (
      <svg className="size-6" viewBox="0 0 24 24" fill="none"><path d="M6 3v8M6 11h6M12 11v4M18 3v14M18 17h-6M12 17v4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
    ) },
  ];

  function renderChildRows(parentId: string, depth: number) {
    const children = childrenMap[parentId];
    if (!children) return null;
    return children.map((child) => (
      <div key={child.id}>
        <div
          className="grid grid-cols-1 md:grid-cols-[1.1fr_1fr_90px_100px_0.7fr_60px] gap-2 md:gap-3 items-center px-6 py-3.5 hover:bg-neutral-50 dark:hover:bg-neutral-800/30 transition-colors"
          style={{ paddingLeft: `${24 + depth * 24}px` }}
        >
          <div className="min-w-0 flex items-center gap-2">
            <button onClick={() => toggleExpand(child.id)} className="p-0.5 rounded hover:bg-neutral-200 dark:hover:bg-neutral-700 transition-colors shrink-0">
              <svg className={`size-3.5 text-neutral-400 transition-transform ${expandedIds.has(child.id) ? "rotate-90" : ""}`} viewBox="0 0 12 12" fill="none">
                <path d="M4.5 2.5l4 3.5-4 3.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
            <p className="text-sm font-semibold text-black dark:text-white truncate">{child.name}</p>
          </div>
          <p className="text-xs text-text-secondary dark:text-neutral-500 truncate">{child.description || "—"}</p>
          <span className={`inline-flex items-center w-fit px-2 py-0.5 text-[11px] font-semibold ${TYPE_STYLES[child.type]}`} style={{ borderRadius: 4 }}>
            {tclass(`types.${child.type}`)}
          </span>
          <span
                    className={`inline-flex items-center w-fit px-2 py-0.5 text-[11px] font-semibold ${
                      child.active
                        ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400"
                        : "bg-neutral-200 text-neutral-600 dark:bg-neutral-800 dark:text-neutral-400"
                    }`}
                    style={{ borderRadius: 4 }}
                  >
                    {child.active ? t("active") : t("inactive")}
                  </span>
          <p className="text-xs text-black dark:text-white truncate">{child.parentName || parentName(child.parentId)}</p>
          <div className="flex justify-end" onClick={(e) => e.stopPropagation()}>
            {canManage && (
              <>
                <button onClick={() => openEditModal(child)} className="p-1.5 rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors cursor-pointer" title={tc("edit")}>
                  <svg className="size-4 text-neutral-500" viewBox="0 0 16 16" fill="none"><path d="M11.5 1.5l3 3-9 9H2.5v-3l9-9z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" /></svg>
                </button>
                <button
                  onClick={() => toggleActive(child)}
                  disabled={togglingId === child.id}
                  className="p-1.5 rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors cursor-pointer disabled:opacity-50"
                  title={child.active ? t("actions.deactivate") : t("actions.reactivate")}
                >
                  {child.active ? (
                    <svg className="size-4 text-neutral-500" viewBox="0 0 16 16" fill="none"><circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="1.3" /><path d="M4.5 4.5l7 7" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" /></svg>
                  ) : (
                    <svg className="size-4 text-emerald-600" viewBox="0 0 16 16" fill="none"><circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="1.3" /><path d="M5.5 8l1.8 1.8L10.5 6.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" /></svg>
                  )}
                </button>
              </>
            )}
          </div>
        </div>
        {expandedIds.has(child.id) && (
          loadingChildren.has(child.id) ? (
            <div className="px-6 py-2" style={{ paddingLeft: `${48 + depth * 24}px` }}><Skeleton className="w-32 h-4" /></div>
          ) : renderChildRows(child.id, depth + 1)
        )}
      </div>
    ));
  }

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
              <svg className="size-4" viewBox="0 0 16 16" fill="none"><path d="M8 3v10M3 8h10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" /></svg>
              <p className="text-sm font-medium">{t("newCategory")}</p>
            </span>
          </button>
        )}
      </div>

      {/* ===== STAT CARDS ===== */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {cardData.map((s) => (
          <div key={s.key} className="relative overflow-hidden rounded-2xl border border-border dark:border-neutral-800 bg-white dark:bg-neutral-900 p-5 pl-6 shadow-card transition-all duration-200 hover:shadow-lg hover:-translate-y-0.5">
            <span className={`absolute top-0 bottom-0 left-0 w-1 ${accentBar(s.color)}`} aria-hidden="true" />
            <div className="flex items-center gap-3 mb-3">
              <div className={`rounded-xl p-2.5 ${s.bg} ${s.color}`}>{s.icon}</div>
              <span className="text-sm font-medium text-text-secondary dark:text-neutral-400">{s.label}</span>
            </div>
            {loading ? <Skeleton className="w-10 h-8" /> : <span className="text-3xl font-bold text-black dark:text-white tabular-nums block">{s.count}</span>}
          </div>
        ))}
      </div>

      {/* ===== RECHERCHE + FILTRES ===== */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-neutral-400" viewBox="0 0 16 16" fill="none">
            <circle cx="7" cy="7" r="5" stroke="currentColor" strokeWidth="1.3" />
            <path d="M11 11l3.5 3.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
          </svg>
          <input value={search} onChange={(e) => setSearch(e.target.value)} onKeyDown={searchKeyHandler(setSearch)} placeholder={t("searchPlaceholder")} className="input w-full h-10 pl-9" />
        </div>
        <select value={filterType} onChange={(e) => setFilterType(e.target.value)} className="input h-10 min-w-[150px]">
          <option value="">{t("allTypes")}</option>
          {TYPES.map((ty) => <option key={ty} value={ty}>{tclass(`types.${ty}`)}</option>)}
        </select>
        <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} className="input h-10 min-w-[140px]">
          <option value="">{t("allStatuses")}</option>
          <option value="ACTIVE">{t("active")}</option>
          <option value="INACTIVE">{t("inactive")}</option>
        </select>
      </div>

      {/* ===== TABLE ===== */}
      <div className="rounded-2xl border border-border dark:border-neutral-800 bg-white dark:bg-neutral-900 shadow-card overflow-hidden">
        <div className="hidden md:grid grid-cols-[1.1fr_1fr_90px_100px_0.7fr_60px] gap-3 px-6 py-3 bg-neutral-50 dark:bg-neutral-800/40 border-b border-border dark:border-neutral-800 rounded-t-2xl">
          {[t("columns.name"), t("columns.description"), t("columns.type"), t("columns.status"), t("columns.parent"), t("columns.actions")].map((col, i) => (
            <span key={i} className={`text-[11px] font-semibold uppercase tracking-wider text-text-secondary dark:text-neutral-400 ${i === 5 ? "text-right" : ""}`}>{col}</span>
          ))}
        </div>

        {loading ? (
          <div className="px-6 py-4 flex flex-col gap-1">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="hidden md:grid grid-cols-[1.1fr_1fr_90px_100px_0.7fr_60px] gap-3 items-center py-3.5">
                <Skeleton className="w-28 h-4" /><Skeleton className="w-40 h-4" /><Skeleton className="w-16 h-5 !rounded-md" /><Skeleton className="w-16 h-5 !rounded-md" /><Skeleton className="w-20 h-4" /><Skeleton className="w-6 h-6 ml-auto" />
              </div>
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="px-6 py-16 text-center">
            <div className="flex flex-col items-center gap-5">
              <svg className="size-32" viewBox="0 0 130 130" fill="none">
                <rect x="30" y="15" width="70" height="80" rx="6" className="fill-blue-50 dark:fill-blue-900/10 stroke-blue-200 dark:stroke-blue-800/40" strokeWidth="1.5" />
                <path d="M45 35h40M45 50h30M45 65h20" className="stroke-blue-300/50 dark:stroke-blue-700/30" strokeWidth="2" strokeLinecap="round" />
                <rect x="55" y="70" width="40" height="30" rx="4" className="fill-purple-50 dark:fill-purple-900/10 stroke-purple-200 dark:stroke-purple-800/40" strokeWidth="1.5" />
                <path d="M65 80h20M65 90h12" className="stroke-purple-300/50 dark:stroke-purple-700/30" strokeWidth="2" strokeLinecap="round" />
                <circle cx="40" cy="90" r="10" className="fill-primary/15 stroke-primary/40" strokeWidth="1.5" />
                <path d="M40 85v10M35 90h10" className="stroke-primary" strokeWidth="2" strokeLinecap="round" />
                <path d="M20 30l2 4 4 1-3 3 .5 4-3.5-2-3.5 2 .5-4-3-3 4-1 2-4z" className="fill-primary/20" />
                <circle cx="110" cy="25" r="2" className="fill-amber-400/30" />
                <circle cx="25" cy="70" r="1.5" className="fill-emerald-400/30" />
              </svg>
              <div>
                <p className="text-base font-bold text-black dark:text-white">{t("emptyTitle")}</p>
                <p className="text-sm text-text-secondary dark:text-neutral-500 mt-2 max-w-md mx-auto leading-relaxed">{t("emptyDescription")}</p>
              </div>
              {canManage && (
                <button onClick={openCreateModal} className="primary-icon px-5 py-2.5 active-scale mt-1">
                  <span className="flex items-center gap-2">
                    <svg className="size-4" viewBox="0 0 16 16" fill="none"><path d="M8 3v10M3 8h10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" /></svg>
                    <p className="text-sm font-medium">{t("createFirst")}</p>
                  </span>
                </button>
              )}
            </div>
          </div>
        ) : (
          <div className="divide-y divide-border dark:divide-neutral-800">
            {paginated.map((cat) => (
              <div key={cat.id}>
                <div className="grid grid-cols-1 md:grid-cols-[1.1fr_1fr_90px_100px_0.7fr_60px] gap-2 md:gap-3 items-center px-6 py-3.5 hover:bg-neutral-50 dark:hover:bg-neutral-800/30 transition-colors">
                  <div className="min-w-0 flex items-center gap-2">
                    <button onClick={() => toggleExpand(cat.id)} className="p-0.5 rounded hover:bg-neutral-200 dark:hover:bg-neutral-700 transition-colors shrink-0 cursor-pointer">
                      <svg className={`size-3.5 text-neutral-400 transition-transform ${expandedIds.has(cat.id) ? "rotate-90" : ""}`} viewBox="0 0 12 12" fill="none">
                        <path d="M4.5 2.5l4 3.5-4 3.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    </button>
                    <p className="text-sm font-semibold text-black dark:text-white truncate">{cat.name}</p>
                  </div>
                  <p className="text-xs text-text-secondary dark:text-neutral-500 truncate">{cat.description || "—"}</p>
                  <span className={`inline-flex items-center w-fit px-2 py-0.5 text-[11px] font-semibold ${TYPE_STYLES[cat.type]}`} style={{ borderRadius: 4 }}>
                    {tclass(`types.${cat.type}`)}
                  </span>
                  <span
                    className={`inline-flex items-center w-fit px-2 py-0.5 text-[11px] font-semibold ${
                      cat.active
                        ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400"
                        : "bg-neutral-200 text-neutral-600 dark:bg-neutral-800 dark:text-neutral-400"
                    }`}
                    style={{ borderRadius: 4 }}
                  >
                    {cat.active ? t("active") : t("inactive")}
                  </span>
                  <p className="text-xs text-black dark:text-white truncate">{parentName(cat.parentId)}</p>
                  <div className="flex justify-end relative" onClick={(e) => e.stopPropagation()}>
                    <button onClick={() => setOpenMenuId(openMenuId === cat.id ? null : cat.id)} className="p-1.5 rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors cursor-pointer">
                      <svg className="size-5 text-neutral-500 dark:text-neutral-400" viewBox="0 0 16 16" fill="none">
                        <circle cx="8" cy="3" r="1.2" fill="currentColor" /><circle cx="8" cy="8" r="1.2" fill="currentColor" /><circle cx="8" cy="13" r="1.2" fill="currentColor" />
                      </svg>
                    </button>
                    <ActionMenu open={openMenuId === cat.id} onClose={() => setOpenMenuId(null)} minWidth={160}>
                        {canManage && (
                          <>
                            <button onClick={() => openEditModal(cat)} className="flex items-center gap-2 w-full px-3 py-2 text-sm text-black dark:text-white rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-700 transition-colors">
                              <svg className="size-4 text-neutral-500" viewBox="0 0 16 16" fill="none"><path d="M11.5 1.5l3 3-9 9H2.5v-3l9-9z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" /></svg>
                              {tc("edit")}
                            </button>
                            <button onClick={() => toggleActive(cat)} disabled={togglingId === cat.id} className="flex items-center gap-2 w-full px-3 py-2 text-sm text-black dark:text-white rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-700 transition-colors disabled:opacity-50">
                              {cat.active ? (
                                <svg className="size-4 text-neutral-500" viewBox="0 0 16 16" fill="none"><circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="1.3" /><path d="M4.5 4.5l7 7" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" /></svg>
                              ) : (
                                <svg className="size-4 text-emerald-600" viewBox="0 0 16 16" fill="none"><circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="1.3" /><path d="M5.5 8l1.8 1.8L10.5 6.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" /></svg>
                              )}
                              {cat.active ? t("actions.deactivate") : t("actions.reactivate")}
                            </button>
                            <button onClick={() => { setDeleteTarget(cat); setOpenMenuId(null); }} className="flex items-center gap-2 w-full px-3 py-2 text-sm text-red-600 dark:text-red-400 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors">
                              <svg className="size-4" viewBox="0 0 16 16" fill="none"><path d="M3 4h10M6 4V3a1 1 0 011-1h2a1 1 0 011 1v1M5 4v9a1 1 0 001 1h4a1 1 0 001-1V4" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" /></svg>
                              {tc("delete")}
                            </button>
                          </>
                        )}
                    </ActionMenu>
                  </div>
                </div>
                {expandedIds.has(cat.id) && (
                  loadingChildren.has(cat.id) ? (
                    <div className="px-6 py-2" style={{ paddingLeft: 48 }}><Skeleton className="w-32 h-4" /></div>
                  ) : renderChildRows(cat.id, 1)
                )}
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm px-4" onClick={(e) => { if (e.target === e.currentTarget) { setShowModal(false); resetForm(); } }}>
          <div className="bg-white dark:bg-neutral-900 border border-border dark:border-neutral-800 rounded-2xl shadow-xl w-full max-w-md overflow-hidden animate-fade-in">
            <div className="flex items-center justify-between px-6 py-4 border-b border-border dark:border-neutral-800">
              <h2 className="text-base font-bold text-black dark:text-white">{isEditing ? t("editTitle") : t("createTitle")}</h2>
              <button onClick={() => { setShowModal(false); resetForm(); }} className="p-1.5 rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors cursor-pointer">
                <svg className="size-4 text-neutral-500" viewBox="0 0 16 16" fill="none"><path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" /></svg>
              </button>
            </div>
            <form onSubmit={handleCreate}>
              <div className="px-6 py-5 flex flex-col gap-4 max-h-[60vh] overflow-y-auto">
                <div className="flex flex-col gap-1.5">
                  <label className="text-[11px] font-semibold uppercase tracking-wider text-text-secondary dark:text-neutral-400">{t("form.name")}</label>
                  <input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="input w-full h-10" />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-[11px] font-semibold uppercase tracking-wider text-text-secondary dark:text-neutral-400">{t("form.description")}</label>
                  <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={3} className="input w-full resize-none" />
                </div>
                {/* Le type est le premier niveau de classification : il conditionne
                    les catégories parentes proposées juste en dessous. Il est figé
                    en modification — le changer invaliderait les sous-catégories et
                    les éléments déjà rangés dans la branche. */}
                <div className="flex flex-col gap-1.5">
                  <label className="text-[11px] font-semibold uppercase tracking-wider text-text-secondary dark:text-neutral-400">
                    {t("form.type")} <span className="text-primary">*</span>
                  </label>
                  <select
                    required
                    disabled={isEditing || !!form.parentId}
                    value={form.type}
                    onChange={(e) => setForm({ ...form, type: e.target.value, parentId: "" })}
                    className="input w-full h-10 disabled:opacity-60"
                  >
                    <option value="">{t("form.chooseType")}</option>
                    {TYPES.map((ty) => (
                      <option key={ty} value={ty}>{tclass(`types.${ty}`)}</option>
                    ))}
                  </select>
                  {isEditing && (
                    <span className="text-[11px] text-text-secondary dark:text-neutral-500">{t("form.typeImmutable")}</span>
                  )}
                  {!isEditing && !!form.parentId && (
                    <span className="text-[11px] text-text-secondary dark:text-neutral-500">{t("form.typeLocked")}</span>
                  )}
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-[11px] font-semibold uppercase tracking-wider text-text-secondary dark:text-neutral-400">{t("form.parent")}</label>
                  <select
                    value={form.parentId}
                    disabled={isEditing || !form.type}
                    onChange={(e) => {
                      const parent = categories.find((c) => c.id === e.target.value);
                      setForm({
                        ...form,
                        parentId: e.target.value,
                        // Une sous-catégorie hérite du type de son parent : on
                        // aligne l'affichage sur ce que le serveur appliquera.
                        type: parent ? parent.type : form.type,
                      });
                    }}
                    className="input w-full h-10 disabled:opacity-60"
                  >
                    <option value="">{t("form.noParent")}</option>
                    {categories
                      .filter((c) => c.type === form.type && c.active)
                      .filter((c) => !editingCategory || c.id !== editingCategory.id)
                      .map((c) => (
                        <option key={c.id} value={c.id}>{c.name}</option>
                      ))}
                  </select>
                </div>
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

      {/* ===== MODAL SUPPRESSION ===== */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm px-4" onClick={(e) => { if (e.target === e.currentTarget) setDeleteTarget(null); }}>
          <div className="bg-white dark:bg-neutral-900 border border-border dark:border-neutral-800 rounded-2xl shadow-xl w-full max-w-sm overflow-hidden animate-fade-in">
            <div className="px-6 py-6 flex flex-col items-center gap-4 text-center">
              <div className="size-14 rounded-2xl bg-red-50 dark:bg-red-900/20 flex items-center justify-center">
                <svg className="size-7 text-red-600 dark:text-red-400" viewBox="0 0 16 16" fill="none"><path d="M3 4h10M6 4V3a1 1 0 011-1h2a1 1 0 011 1v1M5 4v9a1 1 0 001 1h4a1 1 0 001-1V4" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" /></svg>
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
              <button onClick={handleDelete} disabled={deleting} className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white text-sm font-medium rounded-lg active-scale disabled:opacity-60 transition-colors cursor-pointer">
                {deleting ? tc("deleting") : tc("delete")}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
