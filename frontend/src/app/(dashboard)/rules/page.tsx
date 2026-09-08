"use client";

import { useEffect, useState, useRef } from "react";
import api, { apiError } from "@/lib/api";
import { searchKeyHandler } from "@/lib/search";
import type { BusinessRule, CatalogItem } from "@/lib/types";
import toast from "react-hot-toast";
import { useTranslations } from "next-intl";
import { accentBar } from "@/lib/accent";
import ActionMenu from "@/components/ActionMenu";

const RULE_TYPE_LIST = ["COMPATIBILITY", "INCOMPATIBILITY", "MANDATORY_COMPOSITION", "PACK_ONLY"];

/** Incoherence de l'ensemble des regles, telle que renvoyee par GET /rules/consistency. */
interface ConsistencyIssue {
  code: string;
  severity: "ERROR" | "WARNING";
  ruleIds: string[];
  message: string;
}

const EMPTY_FORM = {
  name: "",
  description: "",
  ruleType: "COMPATIBILITY",
  // Une regle metier declaree est une contrainte : elle bloque par defaut, et
  // c'est a son auteur de la relacher s'il veut seulement avertir.
  blocking: true,
  sourceItemId: "",
  targetItemId: "",
};

function Skeleton({ className }: { className: string }) {
  return <div className={`rounded-lg bg-neutral-100 dark:bg-neutral-800 animate-pulse ${className}`} />;
}

const PER_PAGE = 10;

export default function RulesPage() {
  const t = useTranslations("rules");
  const tc = useTranslations("common");

  const [rules, setRules] = useState<BusinessRule[]>([]);
  // Les regles ne portent que les identifiants de leurs elements. Sans le
  // catalogue, l'ecran affichait des UUID tronques et le formulaire exigeait
  // qu'ils soient saisis a la main.
  const [items, setItems] = useState<CatalogItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterType, setFilterType] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [filterSource, setFilterSource] = useState("");
  const [showCreateMenu, setShowCreateMenu] = useState(false);

  const [showModal, setShowModal] = useState(false);
  const [creating, setCreating] = useState(false);
  const [editingRule, setEditingRule] = useState<BusinessRule | null>(null);
  const [form, setForm] = useState({ ...EMPTY_FORM });
  const modalRef = useRef<HTMLDivElement>(null);

  const [detailRule, setDetailRule] = useState<BusinessRule | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<BusinessRule | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  /**
   * Coherence globale des regles (cahier des charges 7.3).
   *
   * Chaque regle est valide isolement ; c'est leur ensemble qui peut se
   * contredire ou se repeter. Le controle est recalcule apres chaque
   * enregistrement, activation ou suppression, sur l'etat reel de la base.
   */
  const [issues, setIssues] = useState<ConsistencyIssue[] | null>(null);
  const [highlightedRuleIds, setHighlightedRuleIds] = useState<string[]>([]);

  const isEditing = !!editingRule;

  useEffect(() => { loadRules(); loadItems(); }, []);

  useEffect(() => {
    function handleEscape(e: KeyboardEvent) {
      if (e.key === "Escape") {
        if (deleteTarget) { setDeleteTarget(null); return; }
        if (detailRule) { setDetailRule(null); return; }
        if (showModal) { setShowModal(false); resetForm(); }
      }
    }
    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [showModal, deleteTarget, detailRule]);

  useEffect(() => {
    function handleClickOutside() {
      if (openMenuId) setOpenMenuId(null);
      if (showCreateMenu) setShowCreateMenu(false);
    }
    document.addEventListener("click", handleClickOutside);
    return () => document.removeEventListener("click", handleClickOutside);
  }, [openMenuId, showCreateMenu]);

  useEffect(() => { setPage(1); }, [search, filterType, filterStatus, filterSource]);

  async function loadRules() {
    try {
      const { data } = await api.get("/rules");
      setRules(data);
    } catch (e) { toast.error(apiError(e, tc("errors.load"))); }
    finally { setLoading(false); }
    loadConsistency();
  }

  async function loadConsistency() {
    try {
      const { data } = await api.get("/rules/consistency");
      setIssues(Array.isArray(data) ? data : []);
    } catch (e) {
      // Sans verdict, on ne dit pas que tout est coherent.
      setIssues(null);
      toast.error(apiError(e, tc("errors.load")));
    }
  }

  async function loadItems() {
    try {
      const { data } = await api.get("/catalog", { params: { size: 500 } });
      setItems(data.content ?? data);
    } catch (e) { toast.error(apiError(e, tc("errors.load"))); }
  }

  function itemName(id: string | null): string {
    if (!id) return "—";
    return items.find((i) => i.id === id)?.name ?? id.slice(0, 8) + "...";
  }

  function resetForm() { setForm({ ...EMPTY_FORM }); setEditingRule(null); }
  function openCreateModal() { resetForm(); setShowModal(true); setShowCreateMenu(false); }

  function openEditModal(rule: BusinessRule) {
    setEditingRule(rule);
    setForm({
      name: rule.name,
      description: rule.description || "",
      ruleType: rule.ruleType,
      blocking: rule.blocking ?? true,
      sourceItemId: rule.sourceItemId || "",
      targetItemId: rule.targetItemId || "",
    });
    setShowModal(true);
    setOpenMenuId(null);
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (creating) return;
    setCreating(true);
    try {
      const payload = {
        name: form.name,
        description: form.description || null,
        ruleType: form.ruleType,
        sourceItemId: form.sourceItemId,
        targetItemId: form.targetItemId,
        blocking: form.blocking,
      };
      if (isEditing) {
        await api.put(`/rules/${editingRule!.id}`, payload);
        toast.success(t("messages.updated"));
      } else {
        await api.post("/rules", payload);
        toast.success(t("messages.created"));
      }
      setShowModal(false); resetForm(); loadRules();
    } catch (e) {
      toast.error(apiError(e, isEditing ? tc("errors.update") : tc("errors.create")));
    } finally { setCreating(false); }
  }

  async function handleDelete() {
    if (!deleteTarget || deleting) return;
    setDeleting(true);
    try { await api.delete(`/rules/${deleteTarget.id}`); toast.success(t("messages.deleted")); loadRules(); }
    catch (e) { toast.error(apiError(e, tc("errors.delete"))); }
    finally { setDeleting(false); setDeleteTarget(null); }
  }

  async function toggleActive(rule: BusinessRule) {
    const endpoint = rule.active ? `/rules/${rule.id}/deactivate` : `/rules/${rule.id}/activate`;
    try {
      await api.patch(endpoint);
      toast.success(rule.active ? t("messages.deactivated") : t("messages.activated"));
      loadRules();
    } catch (e) {
      toast.error(apiError(e, tc("errors.action")));
    }
    setOpenMenuId(null);
  }

  function formatDate(date: string) {
    return new Date(date).toLocaleDateString(undefined, { day: "2-digit", month: "short", year: "numeric" });
  }

  const filtered = rules.filter((r) => {
    if (search && !r.name.toLowerCase().includes(search.toLowerCase())) return false;
    if (filterType && r.ruleType !== filterType) return false;
    if (filterStatus === "active" && !r.active) return false;
    if (filterStatus === "inactive" && r.active) return false;
    if (filterSource && r.sourceItemId !== filterSource) return false;
    return true;
  });

  const totalPages = Math.ceil(filtered.length / PER_PAGE);
  const paginated = filtered.slice((page - 1) * PER_PAGE, page * PER_PAGE);

  // La table business_rules ne connait que l'etat actif/inactif : aucune regle
  // n'y est archivee. La quatrieme carte annoncait donc un zero definitif tout
  // en affichant l'integralite des regles au clic. Elle compte desormais les
  // incompatibilites, la categorie la plus surveillee.
  const stats = {
    total: rules.length,
    active: rules.filter((r) => r.active).length,
    draft: rules.filter((r) => !r.active).length,
    incompatibilities: rules.filter((r) => r.ruleType === "INCOMPATIBILITY").length,
  };

  const cardData = [
    { key: "total", count: stats.total, label: t("stats.totalRules"), link: t("stats.viewAll"), color: "text-blue-600 dark:text-blue-400", bg: "bg-blue-100 dark:bg-blue-900/30", filterStatus: "", filterType: "", icon: (
      <svg className="size-6" viewBox="0 0 24 24" fill="none"><rect x="3" y="3" width="7" height="7" rx="1.5" stroke="currentColor" strokeWidth="1.5" /><rect x="14" y="3" width="7" height="7" rx="1.5" stroke="currentColor" strokeWidth="1.5" /><rect x="3" y="14" width="7" height="7" rx="1.5" stroke="currentColor" strokeWidth="1.5" /><rect x="14" y="14" width="7" height="7" rx="1.5" stroke="currentColor" strokeWidth="1.5" /></svg>
    ) },
    { key: "active", count: stats.active, label: t("stats.activeRules"), link: t("stats.viewActive"), color: "text-emerald-600 dark:text-emerald-400", bg: "bg-emerald-100 dark:bg-emerald-900/30", filterStatus: "active", filterType: "", icon: (
      <svg className="size-6" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.5" /><path d="M8 12l3 3 5-6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
    ) },
    { key: "draft", count: stats.draft, label: t("stats.draftRules"), link: t("stats.viewDrafts"), color: "text-amber-600 dark:text-amber-400", bg: "bg-amber-100 dark:bg-amber-900/30", filterStatus: "inactive", filterType: "", icon: (
      <svg className="size-6" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.5" /><path d="M12 8v4M12 14.5v.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" /></svg>
    ) },
    { key: "incompatibilities", count: stats.incompatibilities, label: t("types.INCOMPATIBILITY"), link: t("stats.viewAll"), color: "text-purple-600 dark:text-purple-400", bg: "bg-purple-100 dark:bg-purple-900/30", filterStatus: "", filterType: "INCOMPATIBILITY", icon: (
      <svg className="size-6" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.5" /><path d="M8 8l8 8M16 8l-8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" /></svg>
    ) },
  ];

  return (
    <div className="flex flex-col gap-6 pb-8">

      {/* ===== HEADER ===== */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-black dark:text-white">{t("title")}</h1>
          <p className="text-sm text-text-secondary dark:text-neutral-500 mt-1">{t("subtitle")}</p>
        </div>
        <div className="relative" onClick={(e) => e.stopPropagation()}>
          <div className="flex">
            <button onClick={openCreateModal} className="primary-icon px-4 py-2.5 rounded-r-none active-scale">
              <span className="flex items-center gap-2">
                <svg className="size-4" viewBox="0 0 16 16" fill="none">
                  <path d="M8 3v10M3 8h10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                </svg>
                <p className="text-sm font-medium">{t("newRule")}</p>
              </span>
            </button>
            <button
              onClick={() => setShowCreateMenu(!showCreateMenu)}
              className="primary-icon px-2 py-2.5 rounded-l-none border-l border-white/20 active-scale"
            >
              <svg className={`size-4 transition-transform ${showCreateMenu ? "rotate-180" : ""}`} viewBox="0 0 16 16" fill="none">
                <path d="M4 6l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
          </div>
          <ActionMenu open={showCreateMenu} onClose={() => setShowCreateMenu(false)} minWidth={220}>
              <button
                onClick={openCreateModal}
                className="flex items-center gap-2.5 w-full px-3 py-2.5 text-sm text-black dark:text-white rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-700 transition-colors"
              >
                <svg className="size-4 text-neutral-500" viewBox="0 0 16 16" fill="none">
                  <path d="M8 3v10M3 8h10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                </svg>
                {t("newRule")}
              </button>
          </ActionMenu>
        </div>
      </div>

      {/* ===== 4 STAT CARDS ===== */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {cardData.map((s) => (
          <button
            key={s.key}
            onClick={() => { setFilterStatus(s.filterStatus); setFilterType(s.filterType); setFilterSource(""); }}
            className="relative overflow-hidden rounded-2xl border border-border dark:border-neutral-800 bg-white dark:bg-neutral-900 p-5 pl-6 shadow-card text-left cursor-pointer transition-all duration-200 hover:shadow-lg hover:-translate-y-0.5"
          >
            <span className={`absolute top-0 bottom-0 left-0 w-1 ${accentBar(s.color)}`} aria-hidden="true" />
            <div className="flex items-center gap-3 mb-3">
              <div className={`rounded-xl p-2.5 ${s.bg} ${s.color}`}>{s.icon}</div>
              <span className="text-sm font-medium text-text-secondary dark:text-neutral-400">{s.label}</span>
            </div>
            {loading ? (
              <Skeleton className="w-10 h-8 mb-2" />
            ) : (
              <span className="text-3xl font-bold text-black dark:text-white tabular-nums block mb-2">{s.count}</span>
            )}
            <span className="text-xs font-medium text-primary flex items-center gap-1">
              {s.link}
              <svg className="size-3" viewBox="0 0 12 12" fill="none">
                <path d="M4.5 2.5l4 3.5-4 3.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </span>
          </button>
        ))}
      </div>

      {/* ===== COHERENCE GLOBALE =====
          Le verdict vient du serveur, calcule sur l'ensemble des regles en base.
          Un clic sur une incoherence met en evidence les regles concernees dans
          le tableau. */}
      {issues !== null && (
        <div className={`rounded-2xl border shadow-card overflow-hidden ${issues.length === 0
          ? "border-emerald-200 dark:border-emerald-800/40 bg-emerald-50/60 dark:bg-emerald-900/10"
          : issues.some((i) => i.severity === "ERROR")
            ? "border-red-200 dark:border-red-800/40 bg-white dark:bg-neutral-900"
            : "border-amber-200 dark:border-amber-800/40 bg-white dark:bg-neutral-900"}`}>
          <div className="flex items-center justify-between gap-3 px-5 py-3.5">
            <div className="flex items-center gap-3 min-w-0">
              <div className={`size-9 shrink-0 rounded-xl flex items-center justify-center ${issues.length === 0
                ? "bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400"
                : issues.some((i) => i.severity === "ERROR")
                  ? "bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400"
                  : "bg-amber-100 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400"}`}>
                {issues.length === 0 ? (
                  <svg className="size-4.5" viewBox="0 0 16 16" fill="none"><path d="M3 8l3.5 3.5L13 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
                ) : (
                  <svg className="size-4.5" viewBox="0 0 16 16" fill="none"><path d="M8 2l6.5 11.5H1.5L8 2z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" /><path d="M8 6.5v3M8 11.5v.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" /></svg>
                )}
              </div>
              <div className="min-w-0">
                <p className="text-sm font-bold text-black dark:text-white">{t("consistency.title")}</p>
                <p className="text-xs text-text-secondary dark:text-neutral-500">
                  {issues.length === 0 ? t("consistency.ok", { count: rules.filter((r) => r.active).length }) : t("consistency.found", { count: issues.length })}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              {highlightedRuleIds.length > 0 && (
                <button onClick={() => setHighlightedRuleIds([])} className="text-xs text-text-secondary dark:text-neutral-400 hover:text-black dark:hover:text-white transition-colors cursor-pointer">
                  {t("consistency.clearHighlight")}
                </button>
              )}
              <button onClick={loadConsistency} className="tertiary-icon px-3 py-1.5 active-scale">
                <p className="text-xs font-medium">{t("consistency.recheck")}</p>
              </button>
            </div>
          </div>
          {issues.length > 0 && (
            <ul className="border-t border-border dark:border-neutral-800 divide-y divide-border dark:divide-neutral-800">
              {issues.map((issue, index) => (
                <li key={`${issue.code}-${index}`}>
                  <button
                    type="button"
                    onClick={() => setHighlightedRuleIds(issue.ruleIds)}
                    className="flex w-full items-start gap-3 px-5 py-3 text-left hover:bg-neutral-50 dark:hover:bg-neutral-800/40 transition-colors cursor-pointer"
                  >
                    <span className={`shrink-0 mt-0.5 inline-flex items-center px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider rounded ${issue.severity === "ERROR"
                      ? "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"
                      : "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400"}`}>
                      {t(`consistency.codes.${issue.code}`)}
                    </span>
                    <span className="flex-1 text-xs text-black dark:text-neutral-200 leading-relaxed">{issue.message}</span>
                    <span className="shrink-0 text-[11px] text-text-secondary dark:text-neutral-500 tabular-nums">{t("consistency.rulesInvolved", { count: issue.ruleIds.length })}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
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
            placeholder={t("filters.searchPlaceholder")}
            className="input w-full h-10 pl-9"
          />
        </div>
        <select value={filterType} onChange={(e) => setFilterType(e.target.value)} className="input h-10 min-w-[140px]">
          <option value="">{t("filters.allTypes")}</option>
          {RULE_TYPE_LIST.map((rt) => (
            <option key={rt} value={rt}>{t(`types.${rt}`)}</option>
          ))}
        </select>
        <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} className="input h-10 min-w-[140px]">
          <option value="">{t("filters.allStatuses")}</option>
          <option value="active">{t("statusLabels.active")}</option>
          <option value="inactive">{t("statusLabels.inactive")}</option>
        </select>
        <select value={filterSource} onChange={(e) => setFilterSource(e.target.value)} className="input h-10 min-w-[180px]">
          <option value="">{t("filters.source")}</option>
          {[...new Set(rules.map((r) => r.sourceItemId))].map((id) => (
            <option key={id} value={id}>{itemName(id)}</option>
          ))}
        </select>
      </div>

      {/* ===== TABLEAU ===== */}
      <div className="rounded-2xl border border-border dark:border-neutral-800 bg-white dark:bg-neutral-900 shadow-card overflow-hidden">
        <div className="hidden md:grid grid-cols-[1.2fr_0.8fr_0.8fr_0.8fr_90px_120px_60px] gap-3 px-6 py-3 bg-neutral-50 dark:bg-neutral-800/40 border-b border-border dark:border-neutral-800 rounded-t-2xl">
          {[t("columns.name"), t("columns.type"), t("columns.source"), t("columns.target"), t("columns.status"), t("columns.lastModified"), t("columns.actions")].map((col, i) => (
            <span key={i} className={`text-[11px] font-semibold uppercase tracking-wider text-text-secondary dark:text-neutral-400 flex items-center gap-1 ${i === 6 ? "justify-end" : ""}`}>
              {col}
              {i < 6 && <svg className="size-3 opacity-60" viewBox="0 0 12 12" fill="none"><path d="M4 5l2-2 2 2M4 7l2 2 2-2" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" /></svg>}
            </span>
          ))}
        </div>

        {loading ? (
          <div className="px-6 py-4 flex flex-col gap-1">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="hidden md:grid grid-cols-[1.2fr_0.8fr_0.8fr_0.8fr_90px_120px_60px] gap-3 items-center py-3.5">
                <Skeleton className="w-28 h-4" />
                <Skeleton className="w-20 h-5 !rounded-md" />
                <Skeleton className="w-16 h-4" />
                <Skeleton className="w-16 h-4" />
                <Skeleton className="w-12 h-5 !rounded-md" />
                <Skeleton className="w-20 h-4" />
                <Skeleton className="w-6 h-6 ml-auto" />
              </div>
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="px-6 py-16 text-center">
            <div className="flex flex-col items-center gap-5">
              <svg className="size-32" viewBox="0 0 130 130" fill="none">
                {/* Document avec lignes */}
                <rect x="35" y="20" width="60" height="75" rx="6" className="fill-blue-50 dark:fill-blue-900/10 stroke-blue-200 dark:stroke-blue-800/40" strokeWidth="1.5" />
                <path d="M48 38h34M48 48h26M48 58h20M48 68h30" className="stroke-blue-300/50 dark:stroke-blue-700/30" strokeWidth="2" strokeLinecap="round" />
                {/* Icône de check/rules */}
                <circle cx="85" cy="78" r="16" className="fill-emerald-100/60 dark:fill-emerald-900/15 stroke-emerald-300 dark:stroke-emerald-700/40" strokeWidth="1.5" />
                <path d="M78 78l4 4 7-8" className="stroke-emerald-500 dark:stroke-emerald-400" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                {/* Cercle + */}
                <circle cx="55" cy="85" r="10" className="fill-primary/15 stroke-primary/40" strokeWidth="1.5" />
                <path d="M55 80v10M50 85h10" className="stroke-primary" strokeWidth="2" strokeLinecap="round" />
                {/* Étoiles déco */}
                <path d="M25 35l2 4 4 1-3 3 .5 4-3.5-2-3.5 2 .5-4-3-3 4-1 2-4z" className="fill-primary/20" />
                <path d="M105 25l1.5 3 3 .7-2.2 2.2.4 3-2.7-1.5-2.7 1.5.4-3-2.2-2.2 3-.7 1.5-3z" className="fill-blue-400/20" />
                <circle cx="28" cy="75" r="2" className="fill-emerald-400/30" />
                <circle cx="108" cy="50" r="1.5" className="fill-amber-400/30" />
              </svg>
              <div>
                <p className="text-base font-bold text-black dark:text-white">{t("emptyTitle")}</p>
                <p className="text-sm text-text-secondary dark:text-neutral-500 mt-2 max-w-md mx-auto leading-relaxed">{t("emptyDescription")}</p>
              </div>
              <button onClick={openCreateModal} className="primary-icon px-5 py-2.5 active-scale mt-1">
                <span className="flex items-center gap-2">
                  <svg className="size-4" viewBox="0 0 16 16" fill="none">
                    <path d="M8 3v10M3 8h10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                  </svg>
                  <p className="text-sm font-medium">{t("createFirst")}</p>
                </span>
              </button>
            </div>
          </div>
        ) : (
          <div className="divide-y divide-border dark:divide-neutral-800">
            {paginated.map((rule) => (
              <div
                key={rule.id}
                className={`grid grid-cols-1 md:grid-cols-[1.2fr_0.8fr_0.8fr_0.8fr_90px_120px_60px] gap-2 md:gap-3 items-center px-6 py-3.5 hover:bg-neutral-50 dark:hover:bg-neutral-800/30 transition-colors cursor-pointer ${highlightedRuleIds.includes(rule.id) ? "bg-amber-50 dark:bg-amber-900/15 ring-1 ring-inset ring-amber-300 dark:ring-amber-700" : ""}`}
                onClick={() => setDetailRule(rule)}
              >
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-black dark:text-white truncate">{rule.name}</p>
                  {rule.description && <p className="text-[11px] text-text-secondary dark:text-neutral-500 truncate">{rule.description}</p>}
                </div>
                <span className="inline-flex items-center w-fit px-2 py-0.5 text-[11px] font-semibold rounded-md bg-black text-white dark:bg-white dark:text-black">
                  {t(`types.${rule.ruleType}`)}
                </span>
                <p className="text-xs text-black dark:text-white truncate">{itemName(rule.sourceItemId)}</p>
                <p className="text-xs text-black dark:text-white truncate">{itemName(rule.targetItemId)}</p>
                <span className={`inline-flex items-center w-fit px-2 py-0.5 text-[11px] font-semibold rounded-md ${
                  rule.active
                    ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400"
                    : "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"
                }`}>
                  {rule.active ? t("statusLabels.active") : t("statusLabels.inactive")}
                </span>
                <span className="text-xs text-text-secondary dark:text-neutral-400">{formatDate(rule.createdAt)}</span>
                <div className="flex justify-end relative" onClick={(e) => e.stopPropagation()}>
                  <button
                    onClick={() => setOpenMenuId(openMenuId === rule.id ? null : rule.id)}
                    className="p-1.5 rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
                  >
                    <svg className="size-5 text-neutral-500 dark:text-neutral-400" viewBox="0 0 16 16" fill="none">
                      <circle cx="8" cy="3" r="1.2" fill="currentColor" />
                      <circle cx="8" cy="8" r="1.2" fill="currentColor" />
                      <circle cx="8" cy="13" r="1.2" fill="currentColor" />
                    </svg>
                  </button>
                  <ActionMenu open={openMenuId === rule.id} onClose={() => setOpenMenuId(null)} minWidth={160}>
                      <button onClick={() => { setDetailRule(rule); setOpenMenuId(null); }} className="flex items-center gap-2 w-full px-3 py-2 text-sm text-black dark:text-white rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-700 transition-colors">
                        <svg className="size-4 text-neutral-500" viewBox="0 0 16 16" fill="none"><circle cx="8" cy="8" r="6.5" stroke="currentColor" strokeWidth="1.5" /><path d="M8 7v4M8 5.5v.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" /></svg>
                        {tc("status")}
                      </button>
                      <button onClick={() => openEditModal(rule)} className="flex items-center gap-2 w-full px-3 py-2 text-sm text-black dark:text-white rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-700 transition-colors">
                        <svg className="size-4 text-neutral-500" viewBox="0 0 16 16" fill="none"><path d="M11.5 1.5l3 3-9 9H2.5v-3l9-9z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" /></svg>
                        {tc("edit")}
                      </button>
                      <button onClick={() => toggleActive(rule)} className="flex items-center gap-2 w-full px-3 py-2 text-sm text-black dark:text-white rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-700 transition-colors">
                        <svg className={`size-4 ${rule.active ? "text-amber-600" : "text-emerald-600"}`} viewBox="0 0 16 16" fill="none">
                          {rule.active ? (
                            <path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                          ) : (
                            <path d="M3 8l3.5 3.5L13 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                          )}
                        </svg>
                        {rule.active ? t("deactivate") : t("activate")}
                      </button>
                      <button onClick={() => { setDeleteTarget(rule); setOpenMenuId(null); }} className="flex items-center gap-2 w-full px-3 py-2 text-sm text-red-600 dark:text-red-400 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors">
                        <svg className="size-4" viewBox="0 0 16 16" fill="none"><path d="M3 4h10M6 4V3a1 1 0 011-1h2a1 1 0 011 1v1M5 4v9a1 1 0 001 1h4a1 1 0 001-1V4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
                        {tc("delete")}
                      </button>
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm px-4" onClick={(e) => { if (e.target === e.currentTarget) { setShowModal(false); resetForm(); } }}>
          <div ref={modalRef} className="bg-white dark:bg-neutral-900 border border-border dark:border-neutral-800 rounded-2xl shadow-xl w-full max-w-md overflow-hidden animate-fade-in">
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
                <div className="flex flex-col gap-1.5">
                  <label className="text-[11px] font-semibold uppercase tracking-wider text-text-secondary dark:text-neutral-400">{t("form.ruleType")}</label>
                  <select value={form.ruleType} onChange={(e) => setForm({ ...form, ruleType: e.target.value })} className="input w-full h-10" required>
                    {RULE_TYPE_LIST.map((rt) => (
                      <option key={rt} value={rt}>{t(`types.${rt}`)}</option>
                    ))}
                  </select>
                </div>

                {/* Sévérité de la contrainte.
                    Le cahier des charges (7.3) prévoit que le système « bloque ou
                    avertit » : les deux comportements étaient donc attendus, mais
                    rien en base ne permettait de choisir — business_rules ne
                    portait que `active`. Sans ce réglage, toute nouvelle règle
                    serait bloquante dès sa création, ce qui interdit d'introduire
                    progressivement une contrainte sur un catalogue déjà constitué :
                    les offres existantes qui la violent deviendraient d'un coup
                    insoumissibles. */}
                <div className="flex flex-col gap-1.5">
                  <label className="text-[11px] font-semibold uppercase tracking-wider text-text-secondary dark:text-neutral-400">
                    {t("form.severity")}
                  </label>
                  <div className="flex flex-col gap-1.5">
                    {[
                      { value: true, label: t("form.blocking"), hint: t("form.blockingHint") },
                      { value: false, label: t("form.warning"), hint: t("form.warningHint") },
                    ].map((option) => (
                      <button
                        type="button"
                        key={String(option.value)}
                        onClick={() => setForm({ ...form, blocking: option.value })}
                        className={`rounded-xl border px-3 py-2.5 text-left transition-colors cursor-pointer ${
                          form.blocking === option.value
                            ? "border-primary bg-primary/5 dark:bg-primary/10"
                            : "border-border dark:border-neutral-800 hover:bg-neutral-50 dark:hover:bg-neutral-800/40"
                        }`}
                      >
                        <span className="block text-sm font-medium text-black dark:text-white">{option.label}</span>
                        <span className="block text-[11px] text-text-secondary dark:text-neutral-500 mt-0.5">{option.hint}</span>
                      </button>
                    ))}
                  </div>
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-[11px] font-semibold uppercase tracking-wider text-text-secondary dark:text-neutral-400">{t("columns.source")}</label>
                  <select required value={form.sourceItemId} onChange={(e) => setForm({ ...form, sourceItemId: e.target.value })} className="input w-full h-10">
                    <option value="">{t("columns.source")}</option>
                    {items.map((i) => <option key={i.id} value={i.id}>{i.name}</option>)}
                  </select>
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-[11px] font-semibold uppercase tracking-wider text-text-secondary dark:text-neutral-400">{t("columns.target")}</label>
                  <select required value={form.targetItemId} onChange={(e) => setForm({ ...form, targetItemId: e.target.value })} className="input w-full h-10">
                    <option value="">{t("columns.target")}</option>
                    {items.filter((i) => i.id !== form.sourceItemId).map((i) => <option key={i.id} value={i.id}>{i.name}</option>)}
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

      {/* ===== MODAL DÉTAIL ===== */}
      {detailRule && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm px-4" onClick={(e) => { if (e.target === e.currentTarget) setDetailRule(null); }}>
          <div className="bg-white dark:bg-neutral-900 border border-border dark:border-neutral-800 rounded-2xl shadow-xl w-full max-w-md overflow-hidden animate-fade-in">
            <div className="flex items-center justify-between px-6 py-4 border-b border-border dark:border-neutral-800">
              <div className="flex items-center gap-3">
                <div className="size-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
                  <svg className="size-5" viewBox="0 0 16 16" fill="none"><path d="M2 2h12M2 14h12M4 6h8M4 10h8M8 2v12" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" /></svg>
                </div>
                <div>
                  <h2 className="text-base font-bold text-black dark:text-white">{detailRule.name}</h2>
                  <span className="inline-flex items-center px-2 py-0.5 text-[11px] font-semibold rounded-md bg-black text-white dark:bg-white dark:text-black">
                    {t(`types.${detailRule.ruleType}`)}
                  </span>
                </div>
              </div>
              <button onClick={() => setDetailRule(null)} className="p-1.5 rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors cursor-pointer">
                <svg className="size-4 text-neutral-500" viewBox="0 0 16 16" fill="none"><path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" /></svg>
              </button>
            </div>
            <div className="px-6 py-5 flex flex-col gap-5 max-h-[60vh] overflow-y-auto">
              {detailRule.description && (
                <div className="flex flex-col gap-1">
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-text-secondary dark:text-neutral-500">{t("form.description")}</p>
                  <p className="text-sm text-black dark:text-white leading-relaxed">{detailRule.description}</p>
                </div>
              )}
              <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col gap-1">
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-text-secondary dark:text-neutral-500">{t("columns.status")}</p>
                  <span className={`inline-flex items-center w-fit px-2 py-0.5 text-[11px] font-semibold rounded-md ${
                    detailRule.active
                      ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400"
                      : "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"
                  }`}>
                    {detailRule.active ? t("statusLabels.active") : t("statusLabels.inactive")}
                  </span>
                </div>
                <div className="flex flex-col gap-1">
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-text-secondary dark:text-neutral-500">{t("columns.type")}</p>
                  <span className="inline-flex items-center w-fit px-2 py-0.5 text-[11px] font-semibold rounded-md bg-black text-white dark:bg-white dark:text-black">
                    {t(`types.${detailRule.ruleType}`)}
                  </span>
                </div>
              </div>
              <div className="flex flex-col gap-1">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-text-secondary dark:text-neutral-500">{t("columns.source")}</p>
                <p className="text-sm font-medium text-black dark:text-white break-words">{itemName(detailRule.sourceItemId)}</p>
              </div>
              <div className="flex flex-col gap-1">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-text-secondary dark:text-neutral-500">{t("columns.target")}</p>
                <p className="text-sm font-medium text-black dark:text-white break-words">{itemName(detailRule.targetItemId)}</p>
              </div>
              <div className="flex flex-col gap-1">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-text-secondary dark:text-neutral-500">{t("columns.lastModified")}</p>
                <p className="text-sm font-medium text-black dark:text-white">{formatDate(detailRule.createdAt)}</p>
              </div>
            </div>
            <div className="flex items-center justify-end gap-2 px-6 py-4 border-t border-border dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-800/30">
              <button onClick={() => { openEditModal(detailRule); setDetailRule(null); }} className="secondary-icon px-4 py-2 active-scale">
                <span className="flex items-center gap-1.5">
                  <svg className="size-3.5" viewBox="0 0 16 16" fill="none"><path d="M11.5 1.5l3 3-9 9H2.5v-3l9-9z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" /></svg>
                  <p className="text-sm font-medium">{tc("edit")}</p>
                </span>
              </button>
              <button onClick={() => setDetailRule(null)} className="tertiary-icon px-4 py-2 active-scale">
                <p className="text-sm font-medium">{tc("close")}</p>
              </button>
            </div>
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
