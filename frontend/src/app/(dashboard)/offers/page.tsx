"use client";

import { useEffect, useState, useRef } from "react";
import api, { apiError } from "@/lib/api";
import { searchKeyHandler } from "@/lib/search";
import { useAuth } from "@/lib/auth";
import type { Offer, OfferStatus } from "@/lib/types";
import toast from "react-hot-toast";
import { useTranslations } from "next-intl";

const PER_PAGE = 10;

const ALLOWED_TRANSITIONS: Record<string, OfferStatus[]> = {
  DRAFT: ["IN_ENRICHMENT"],
  IN_ENRICHMENT: ["IN_VALIDATION", "DRAFT"],
  IN_VALIDATION: ["VALIDATED", "IN_ENRICHMENT"],
  VALIDATED: ["PLANNED", "PUBLISHED"],
  PLANNED: ["PUBLISHED", "SUSPENDED"],
  PUBLISHED: ["SUSPENDED", "OBSOLETE", "WITHDRAWN"],
  SUSPENDED: ["PUBLISHED", "WITHDRAWN"],
  OBSOLETE: ["ARCHIVED"],
  WITHDRAWN: ["ARCHIVED"],
};

/**
 * Permissions admises pour atteindre un statut, en miroir de
 * OfferService.permissionsFor cote serveur. Le circuit refuse depuis qu'une
 * transition exige sa propre permission : proposer un bouton que le serveur
 * refusera afficherait une panne la ou la regle s'applique normalement.
 */
function permissionsForTransition(from: string, target: OfferStatus): string[] {
  switch (target) {
    case "DRAFT":
      return ["OFFER_SUBMIT", "OFFER_ENRICH"];
    case "IN_ENRICHMENT":
      return from === "IN_VALIDATION" ? ["OFFER_VALIDATE"] : ["OFFER_SUBMIT"];
    case "IN_VALIDATION":
      return ["OFFER_SUBMIT"];
    case "VALIDATED":
      return ["OFFER_VALIDATE"];
    default:
      return ["OFFER_PUBLISH"];
  }
}

const EMPTY_FORM = {
  name: "",
  shortDescription: "",
  longDescription: "",
  promotionalPrice: "",
  currency: "XOF",
  targetSegment: "",
  customerType: "",
  legalMentions: "",
};

const STATUS_STYLES: Record<string, string> = {
  DRAFT: "bg-neutral-100 text-neutral-600 dark:bg-neutral-800 dark:text-neutral-400",
  IN_ENRICHMENT: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
  IN_VALIDATION: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
  VALIDATED: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400",
  PLANNED: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400",
  PUBLISHED: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300",
  SUSPENDED: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400",
  OBSOLETE: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
  WITHDRAWN: "bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400",
  ARCHIVED: "bg-neutral-100 text-neutral-500 dark:bg-neutral-800 dark:text-neutral-500",
};

const STATUS_KEYS: OfferStatus[] = ["DRAFT", "IN_ENRICHMENT", "IN_VALIDATION", "VALIDATED", "PLANNED", "PUBLISHED", "SUSPENDED", "OBSOLETE", "WITHDRAWN", "ARCHIVED"];

function Skeleton({ className }: { className: string }) {
  return <div className={`rounded-lg bg-neutral-100 dark:bg-neutral-800 animate-pulse ${className}`} />;
}

export default function OffersPage() {
  const t = useTranslations("offers");
  const tc = useTranslations("common");
  const { user } = useAuth();
  const granted = new Set(user?.permissions ?? []);

  const [offers, setOffers] = useState<Offer[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState("ALL");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [showCreateMenu, setShowCreateMenu] = useState(false);
  const [page, setPage] = useState(1);

  const [showModal, setShowModal] = useState(false);
  const [creating, setCreating] = useState(false);
  const [editingOffer, setEditingOffer] = useState<Offer | null>(null);
  const [form, setForm] = useState({ ...EMPTY_FORM });
  const modalRef = useRef<HTMLDivElement>(null);

  const [detailOffer, setDetailOffer] = useState<Offer | null>(null);
  const [transitionOffer, setTransitionOffer] = useState<Offer | null>(null);
  const [transitionComment, setTransitionComment] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<Offer | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);

  const isEditing = !!editingOffer;

  useEffect(() => { loadOffers(); }, []);

  useEffect(() => {
    function handleEscape(e: KeyboardEvent) {
      if (e.key === "Escape") {
        if (deleteTarget) { setDeleteTarget(null); return; }
        if (transitionOffer) { setTransitionOffer(null); setTransitionComment(""); return; }
        if (detailOffer) { setDetailOffer(null); return; }
        if (showModal) { setShowModal(false); resetForm(); }
      }
    }
    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [showModal, deleteTarget, detailOffer, transitionOffer]);

  useEffect(() => {
    function handleClickOutside() {
      if (openMenuId) setOpenMenuId(null);
      if (showCreateMenu) setShowCreateMenu(false);
    }
    document.addEventListener("click", handleClickOutside);
    return () => document.removeEventListener("click", handleClickOutside);
  }, [openMenuId, showCreateMenu]);

  useEffect(() => { setPage(1); }, [search, filterStatus, dateFrom, dateTo]);

  async function loadOffers() {
    try {
      const { data } = await api.get("/offers", { params: { size: 500 } });
      setOffers(data.content ?? data);
    } catch (e) { toast.error(apiError(e, tc("errors.load"))); }
    finally { setLoading(false); }
  }

  function resetForm() { setForm({ ...EMPTY_FORM }); setEditingOffer(null); }
  function openCreateModal() { resetForm(); setShowModal(true); setShowCreateMenu(false); }

  function openEditModal(offer: Offer) {
    setEditingOffer(offer);
    setForm({
      name: offer.name, shortDescription: offer.shortDescription || "",
      longDescription: offer.longDescription || "",
      promotionalPrice: offer.promotionalPrice?.toString() || "",
      currency: offer.currency || "XOF", targetSegment: offer.targetSegment || "",
      customerType: offer.customerType || "", legalMentions: offer.legalMentions || "",
    });
    setShowModal(true); setOpenMenuId(null);
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (creating) return;
    setCreating(true);
    try {
      if (isEditing) {
        await api.patch(`/offers/${editingOffer!.id}/enrich`, {
          shortDescription: form.shortDescription, longDescription: form.longDescription,
          seoTitle: null, seoDescription: null, legalMentions: form.legalMentions || null,
        });
        toast.success(t("messages.updated"));
      } else {
        await api.post("/offers", {
          name: form.name, shortDescription: form.shortDescription,
          longDescription: form.longDescription,
          promotionalPrice: parseFloat(form.promotionalPrice) || null,
          targetSegment: form.targetSegment || null, customerType: form.customerType || null,
          legalMentions: form.legalMentions || null, catalogItemIds: [],
        });
        toast.success(t("messages.created"));
      }
      setShowModal(false); resetForm(); loadOffers();
    } catch (e) {
      toast.error(apiError(e, isEditing ? tc("errors.update") : tc("errors.create")));
    } finally { setCreating(false); }
  }

  async function handleDelete() {
    if (!deleteTarget || deleting) return;
    setDeleting(true);
    try { await api.delete(`/offers/${deleteTarget.id}`); toast.success(t("messages.deleted")); loadOffers(); }
    catch (e) { toast.error(apiError(e, tc("errors.delete"))); }
    finally { setDeleting(false); setDeleteTarget(null); }
  }

  async function handleTransition(offerId: string, targetStatus: OfferStatus) {
    const needsComment = targetStatus === "IN_ENRICHMENT" || targetStatus === "DRAFT";
    if (needsComment && !transitionComment.trim()) {
      toast.error(t("transition.commentRequired"));
      return;
    }
    try {
      await api.post(`/offers/${offerId}/transition`, { targetStatus, comment: transitionComment || null });
      toast.success(t("messages.transitionSuccess"));
      setTransitionOffer(null); setTransitionComment(""); loadOffers();
    } catch (e) {
      toast.error(apiError(e, tc("errors.action")));
    }
  }

  function formatPrice(price: number, currency: string) {
    return `${price.toLocaleString("fr-FR")} ${currency}`;
  }
  function formatDate(date: string) {
    return new Date(date).toLocaleDateString(undefined, { day: "2-digit", month: "short", year: "numeric" });
  }

  // La periode porte sur la date de creation : c'est la seule date renseignee
  // pour tous les statuts. validFrom reste vide sur les brouillons, qui
  // disparaitraient donc de la liste des qu'une periode serait saisie.
  const filtered = offers.filter((o) => {
    if (filterStatus !== "ALL" && o.status !== filterStatus) return false;
    if (search && !`${o.name} ${o.shortDescription}`.toLowerCase().includes(search.toLowerCase())) return false;
    if (dateFrom && new Date(o.createdAt) < new Date(dateFrom)) return false;
    if (dateTo) {
      const to = new Date(dateTo);
      to.setHours(23, 59, 59, 999);
      if (new Date(o.createdAt) > to) return false;
    }
    return true;
  });

  const totalPages = Math.ceil(filtered.length / PER_PAGE);
  const paginated = filtered.slice((page - 1) * PER_PAGE, page * PER_PAGE);

  const statusCounts = STATUS_KEYS.reduce((acc, k) => {
    acc[k] = offers.filter((o) => o.status === k).length;
    return acc;
  }, {} as Record<string, number>);

  const cardStats = [
    { key: "total", count: offers.length, label: t("stats.totalOffers"), link: t("stats.viewAll"), color: "text-blue-600 dark:text-blue-400", bg: "bg-blue-100 dark:bg-blue-900/30", filterValue: "ALL" },
    { key: "validation", count: statusCounts.IN_VALIDATION ?? 0, label: t("stats.inValidation"), link: t("stats.viewValidations"), color: "text-primary", bg: "bg-primary/10", filterValue: "IN_VALIDATION" },
    { key: "published", count: statusCounts.PUBLISHED ?? 0, label: t("stats.published"), link: t("stats.viewPublished"), color: "text-emerald-600 dark:text-emerald-400", bg: "bg-emerald-100 dark:bg-emerald-900/30", filterValue: "PUBLISHED" },
    { key: "toComplete", count: (statusCounts.DRAFT ?? 0) + (statusCounts.IN_ENRICHMENT ?? 0), label: t("stats.toComplete"), link: t("stats.viewToComplete"), color: "text-blue-600 dark:text-blue-400", bg: "bg-blue-100 dark:bg-blue-900/30", filterValue: "DRAFT" },
  ];

  const cardIcons = [
    <svg key="total" className="size-6" viewBox="0 0 24 24" fill="none"><rect x="3" y="3" width="8" height="8" rx="2" stroke="currentColor" strokeWidth="1.5" /><rect x="13" y="3" width="8" height="8" rx="2" stroke="currentColor" strokeWidth="1.5" /><rect x="3" y="13" width="8" height="8" rx="2" stroke="currentColor" strokeWidth="1.5" /><rect x="13" y="13" width="8" height="8" rx="2" stroke="currentColor" strokeWidth="1.5" /></svg>,
    <svg key="validation" className="size-6" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.5" /><path d="M12 7v5l3 2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>,
    <svg key="published" className="size-6" viewBox="0 0 24 24" fill="none"><path d="M5 13l4 4L19 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>,
    <svg key="toComplete" className="size-6" viewBox="0 0 24 24" fill="none"><rect x="4" y="3" width="16" height="18" rx="2" stroke="currentColor" strokeWidth="1.5" /><path d="M9 7h6M9 11h6M9 15h4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" /></svg>,
  ];

  return (
    <div className="flex flex-col gap-6 pb-8">

      {/* ===== HEADER ===== */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-black dark:text-white">{t("headerTitle")}</h1>
          <p className="text-sm text-text-secondary dark:text-neutral-500 mt-1">{t("headerSubtitle")}</p>
        </div>
        <div className="relative" onClick={(e) => e.stopPropagation()}>
          <div className="flex">
            <button onClick={openCreateModal} className="primary-icon px-4 py-2.5 rounded-r-none active-scale">
              <span className="flex items-center gap-2">
                <svg className="size-4" viewBox="0 0 16 16" fill="none">
                  <path d="M8 3v10M3 8h10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                </svg>
                <p className="text-sm font-medium">{t("createOffer")}</p>
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
          {showCreateMenu && (
            <div className="absolute right-0 top-full mt-1 z-40 bg-white dark:bg-neutral-800 border border-border dark:border-neutral-700 rounded-xl shadow-lg p-1 min-w-[220px] animate-fade-in">
              <button
                onClick={openCreateModal}
                className="flex items-center gap-2.5 w-full px-3 py-2.5 text-sm text-black dark:text-white rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-700 transition-colors"
              >
                <svg className="size-4 text-neutral-500" viewBox="0 0 16 16" fill="none">
                  <path d="M8 3v10M3 8h10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                </svg>
                {t("createOffer")}
              </button>
              <button className="flex items-center gap-2.5 w-full px-3 py-2.5 text-sm text-black dark:text-white rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-700 transition-colors">
                <svg className="size-4 text-neutral-500" viewBox="0 0 16 16" fill="none">
                  <rect x="2" y="2" width="12" height="12" rx="2" stroke="currentColor" strokeWidth="1.3" />
                  <path d="M5 6h6M5 9h4" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
                </svg>
                {t("createFromTemplate")}
              </button>
              <button className="flex items-center gap-2.5 w-full px-3 py-2.5 text-sm text-black dark:text-white rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-700 transition-colors">
                <svg className="size-4 text-neutral-500" viewBox="0 0 16 16" fill="none">
                  <path d="M8 11V3M4 7l4-4 4 4" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
                  <path d="M3 13h10" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
                </svg>
                {t("importOffer")}
              </button>
            </div>
          )}
        </div>
      </div>

      {/* ===== 4 STAT CARDS ===== */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {cardStats.map((s, idx) => (
          <button
            key={s.key}
            onClick={() => setFilterStatus(s.filterValue)}
            className="rounded-2xl border border-border dark:border-neutral-800 bg-white dark:bg-neutral-900 p-5 shadow-card text-left cursor-pointer transition-all duration-200 hover:shadow-lg hover:-translate-y-0.5"
          >
            <div className="flex items-center gap-3 mb-3">
              <div className={`rounded-xl p-2.5 ${s.bg} ${s.color}`}>
                {cardIcons[idx]}
              </div>
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

      {/* ===== STATUS FILTER PILLS ===== */}
      <div className="flex flex-wrap gap-1.5">
        <button
          onClick={() => setFilterStatus("ALL")}
          className={`px-3 py-1.5 text-xs font-medium rounded-full transition-all cursor-pointer ${
            filterStatus === "ALL"
              ? "bg-slate-800 text-white dark:bg-white dark:text-black"
              : "bg-neutral-100 text-text-secondary dark:bg-neutral-800 dark:text-neutral-400 hover:bg-neutral-200 dark:hover:bg-neutral-700"
          }`}
        >
          {t("filterAll")} ({offers.length})
        </button>
        {STATUS_KEYS.map((key) => (
          <button
            key={key}
            onClick={() => setFilterStatus(key)}
            className={`px-3 py-1.5 text-xs font-medium rounded-full transition-all cursor-pointer ${
              filterStatus === key
                ? "bg-slate-800 text-white dark:bg-white dark:text-black"
                : "bg-neutral-100 text-text-secondary dark:bg-neutral-800 dark:text-neutral-400 hover:bg-neutral-200 dark:hover:bg-neutral-700"
            }`}
          >
            {t(`status.${key}`)} ({statusCounts[key] ?? 0})
          </button>
        ))}
      </div>

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
            placeholder={t("searchPlaceholder")}
            className="input w-full h-10 pl-9"
          />
        </div>
        <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} className="input h-10 min-w-[120px]">
          <option value="ALL">{t("filters.status")}</option>
          {STATUS_KEYS.map((k) => <option key={k} value={k}>{t(`status.${k}`)}</option>)}
        </select>
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium text-text-secondary dark:text-neutral-500">{t("filters.date")}</span>
          <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="input h-10" />
          <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="input h-10" />
        </div>
      </div>

      {/* ===== TABLEAU ===== */}
      <div className="rounded-2xl border border-border dark:border-neutral-800 bg-white dark:bg-neutral-900 shadow-card overflow-hidden">
        {/* En-tête bleu navy */}
        <div className="hidden md:grid grid-cols-[1.2fr_0.7fr_90px_100px_100px_80px_110px_60px] gap-3 px-6 py-3 bg-slate-800 dark:bg-slate-900 rounded-t-2xl">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-white">{t("columns.offer")}</span>
          <span className="text-[11px] font-semibold uppercase tracking-wider text-white">{t("columns.type")}</span>
          <span className="text-[11px] font-semibold uppercase tracking-wider text-white">{t("columns.price")}</span>
          <span className="text-[11px] font-semibold uppercase tracking-wider text-white">{t("columns.period")}</span>
          <span className="text-[11px] font-semibold uppercase tracking-wider text-white">{t("columns.status")}</span>
          <span className="text-[11px] font-semibold uppercase tracking-wider text-white">{t("columns.quality")}</span>
          <span className="text-[11px] font-semibold uppercase tracking-wider text-white">{t("columns.lastModified")}</span>
          <span className="text-[11px] font-semibold uppercase tracking-wider text-white text-right">{t("columns.actions")}</span>
        </div>

        {loading ? (
          <div className="px-6 py-4 flex flex-col gap-1">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="hidden md:grid grid-cols-[1.2fr_0.7fr_90px_100px_100px_80px_110px_60px] gap-3 items-center py-3.5">
                <Skeleton className="w-28 h-4" />
                <Skeleton className="w-14 h-5 !rounded-md" />
                <Skeleton className="w-14 h-4" />
                <Skeleton className="w-20 h-4" />
                <Skeleton className="w-16 h-5 !rounded-md" />
                <Skeleton className="w-10 h-4" />
                <Skeleton className="w-16 h-4" />
                <Skeleton className="w-6 h-6 ml-auto" />
              </div>
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="px-6 py-16 text-center">
            <div className="flex flex-col items-center gap-5">
              {/* Illustration */}
              <svg className="size-32" viewBox="0 0 130 130" fill="none">
                {/* Document principal */}
                <rect x="35" y="25" width="60" height="75" rx="6" className="fill-blue-50 dark:fill-blue-900/10 stroke-blue-200 dark:stroke-blue-800/40" strokeWidth="1.5" />
                <path d="M48 42h34M48 52h26M48 62h20" className="stroke-blue-300/50 dark:stroke-blue-700/30" strokeWidth="2" strokeLinecap="round" />
                {/* Cercle + */}
                <circle cx="85" cy="80" r="16" className="fill-primary/15 stroke-primary/40" strokeWidth="1.5" />
                <path d="M85 73v14M78 80h14" className="stroke-primary" strokeWidth="2" strokeLinecap="round" />
                {/* Étoiles déco */}
                <path d="M25 35l2 4 4 1-3 3 .5 4-3.5-2-3.5 2 .5-4-3-3 4-1 2-4z" className="fill-primary/20" />
                <path d="M105 30l1.5 3 3 .7-2.2 2.2.4 3-2.7-1.5-2.7 1.5.4-3-2.2-2.2 3-.7 1.5-3z" className="fill-blue-400/20" />
                <circle cx="28" cy="75" r="2" className="fill-emerald-400/30" />
                <circle cx="108" cy="55" r="1.5" className="fill-amber-400/30" />
              </svg>
              <div>
                <p className="text-base font-bold text-black dark:text-white">{t("emptyTitle")}</p>
                <p className="text-sm text-text-secondary dark:text-neutral-500 mt-2 max-w-md mx-auto leading-relaxed">{t("emptyDescription")}</p>
              </div>
              <div className="flex items-center gap-3 mt-1">
                <button onClick={openCreateModal} className="primary-icon px-5 py-2.5 active-scale">
                  <span className="flex items-center gap-2">
                    <svg className="size-4" viewBox="0 0 16 16" fill="none">
                      <path d="M8 3v10M3 8h10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                    </svg>
                    <p className="text-sm font-medium">{t("createFirstOffer")}</p>
                  </span>
                </button>
              </div>
            </div>
          </div>
        ) : (
          <div className="divide-y divide-border dark:divide-neutral-800">
            {paginated.map((offer) => (
              <div
                key={offer.id}
                className="grid grid-cols-1 md:grid-cols-[1.2fr_0.7fr_90px_100px_100px_80px_110px_60px] gap-2 md:gap-3 items-center px-6 py-3.5 hover:bg-neutral-50 dark:hover:bg-neutral-800/30 transition-colors cursor-pointer"
                onClick={() => setDetailOffer(offer)}
              >
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-black dark:text-white truncate">{offer.name}</p>
                  <p className="text-[11px] text-text-secondary dark:text-neutral-500 truncate">{offer.shortDescription || ""}</p>
                </div>
                <span className="text-xs text-text-secondary dark:text-neutral-400">{offer.targetSegment ? t(`segments.${offer.targetSegment}`) : "—"}</span>
                <p className="text-sm font-semibold text-black dark:text-white tabular-nums">
                  {offer.promotionalPrice ? formatPrice(offer.promotionalPrice, offer.currency) : "—"}
                </p>
                <span className="text-xs text-text-secondary dark:text-neutral-400">
                  {offer.validFrom ? `${formatDate(offer.validFrom)}` : "—"}
                </span>
                <span className={`inline-flex items-center w-fit px-2 py-0.5 text-[11px] font-semibold rounded-md ${STATUS_STYLES[offer.status] ?? STATUS_STYLES.DRAFT}`}>
                  {t(`status.${offer.status}`)}
                </span>
                <div className="flex items-center gap-1.5">
                  <div className="flex-1 h-1.5 bg-neutral-200 dark:bg-neutral-700 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all ${offer.qualityScore >= 80 ? "bg-emerald-500" : offer.qualityScore >= 50 ? "bg-amber-500" : "bg-red-500"}`}
                      style={{ width: `${Math.min(offer.qualityScore, 100)}%` }}
                    />
                  </div>
                  <span className="text-[11px] font-semibold text-black dark:text-white tabular-nums w-7 text-right">{offer.qualityScore}%</span>
                </div>
                <span className="text-xs text-text-secondary dark:text-neutral-400">{formatDate(offer.updatedAt)}</span>
                <div className="flex justify-end relative" onClick={(e) => e.stopPropagation()}>
                  <button
                    onClick={() => setOpenMenuId(openMenuId === offer.id ? null : offer.id)}
                    className="p-1.5 rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
                  >
                    <svg className="size-5 text-neutral-500 dark:text-neutral-400" viewBox="0 0 16 16" fill="none">
                      <circle cx="8" cy="3" r="1.2" fill="currentColor" />
                      <circle cx="8" cy="8" r="1.2" fill="currentColor" />
                      <circle cx="8" cy="13" r="1.2" fill="currentColor" />
                    </svg>
                  </button>
                  {openMenuId === offer.id && (
                    <div className="absolute right-0 top-full mt-1 z-40 bg-white dark:bg-neutral-800 border border-border dark:border-neutral-700 rounded-xl shadow-lg p-1 min-w-[160px] animate-fade-in">
                      <button onClick={() => { setDetailOffer(offer); setOpenMenuId(null); }} className="flex items-center gap-2 w-full px-3 py-2 text-sm text-black dark:text-white rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-700 transition-colors">
                        <svg className="size-4 text-neutral-500" viewBox="0 0 16 16" fill="none"><circle cx="8" cy="8" r="6.5" stroke="currentColor" strokeWidth="1.5" /><path d="M8 7v4M8 5.5v.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" /></svg>
                        {tc("status")}
                      </button>
                      <button onClick={() => openEditModal(offer)} className="flex items-center gap-2 w-full px-3 py-2 text-sm text-black dark:text-white rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-700 transition-colors">
                        <svg className="size-4 text-neutral-500" viewBox="0 0 16 16" fill="none"><path d="M11.5 1.5l3 3-9 9H2.5v-3l9-9z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" /></svg>
                        {tc("edit")}
                      </button>
                      <button onClick={() => { setTransitionOffer(offer); setOpenMenuId(null); }} className="flex items-center gap-2 w-full px-3 py-2 text-sm text-black dark:text-white rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-700 transition-colors">
                        <svg className="size-4 text-neutral-500" viewBox="0 0 16 16" fill="none"><path d="M3 8h10M10 5l3 3-3 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
                        {t("transition.title")}
                      </button>
                      <button onClick={() => { setDeleteTarget(offer); setOpenMenuId(null); }} className="flex items-center gap-2 w-full px-3 py-2 text-sm text-red-600 dark:text-red-400 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors">
                        <svg className="size-4" viewBox="0 0 16 16" fill="none"><path d="M3 4h10M6 4V3a1 1 0 011-1h2a1 1 0 011 1v1M5 4v9a1 1 0 001 1h4a1 1 0 001-1V4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
                        {tc("delete")}
                      </button>
                    </div>
                  )}
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

      {/* ===== 3 FEATURE CARDS ===== */}
      {offers.length === 0 && !loading && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[
            { icon: "workflow", title: t("features.workflow"), desc: t("features.workflowDesc"), color: "text-primary bg-primary/10" },
            { icon: "quality", title: t("features.quality"), desc: t("features.qualityDesc"), color: "text-emerald-600 dark:text-emerald-400 bg-emerald-100 dark:bg-emerald-900/30" },
            { icon: "multichannel", title: t("features.multichannel"), desc: t("features.multichannelDesc"), color: "text-blue-600 dark:text-blue-400 bg-blue-100 dark:bg-blue-900/30" },
          ].map((f) => (
            <div key={f.icon} className="rounded-2xl border border-border dark:border-neutral-800 bg-white dark:bg-neutral-900 p-5 shadow-card flex items-start gap-4">
              <div className={`rounded-xl p-3 shrink-0 ${f.color}`}>
                {f.icon === "workflow" && (
                  <svg className="size-6" viewBox="0 0 24 24" fill="none">
                    <circle cx="6" cy="6" r="3" stroke="currentColor" strokeWidth="1.5" />
                    <circle cx="18" cy="6" r="3" stroke="currentColor" strokeWidth="1.5" />
                    <circle cx="12" cy="18" r="3" stroke="currentColor" strokeWidth="1.5" />
                    <path d="M8 8l2.5 7.5M16 8l-2.5 7.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                  </svg>
                )}
                {f.icon === "quality" && (
                  <svg className="size-6" viewBox="0 0 24 24" fill="none">
                    <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.5" />
                    <path d="M8 12l3 3 5-6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                )}
                {f.icon === "multichannel" && (
                  <svg className="size-6" viewBox="0 0 24 24" fill="none">
                    <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="1.5" />
                    <path d="M12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M5.6 18.4l2.1-2.1M16.3 7.7l2.1-2.1" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                  </svg>
                )}
              </div>
              <div>
                <p className="text-sm font-bold text-black dark:text-white">{f.title}</p>
                <p className="text-xs text-text-secondary dark:text-neutral-500 mt-1 leading-relaxed">{f.desc}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ===== MODAL TRANSITION ===== */}
      {transitionOffer && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm px-4" onClick={(e) => { if (e.target === e.currentTarget) { setTransitionOffer(null); setTransitionComment(""); } }}>
          <div className="bg-white dark:bg-neutral-900 border border-border dark:border-neutral-800 rounded-2xl shadow-xl w-full max-w-md overflow-hidden animate-fade-in">
            <div className="flex items-center justify-between px-6 py-4 border-b border-border dark:border-neutral-800">
              <div>
                <h2 className="text-base font-bold text-black dark:text-white">{t("transition.title")}</h2>
                <p className="text-xs text-text-secondary dark:text-neutral-500 mt-0.5">{transitionOffer.name}</p>
              </div>
              <button onClick={() => { setTransitionOffer(null); setTransitionComment(""); }} className="p-1.5 rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors cursor-pointer">
                <svg className="size-4 text-neutral-500" viewBox="0 0 16 16" fill="none"><path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" /></svg>
              </button>
            </div>
            <div className="px-6 py-5 flex flex-col gap-4">
              <div className="flex items-center gap-2">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-text-secondary dark:text-neutral-500">{t("transition.currentStatus")}</p>
                <span className={`inline-flex items-center px-2 py-0.5 text-[11px] font-semibold rounded-md ${STATUS_STYLES[transitionOffer.status]}`}>
                  {t(`status.${transitionOffer.status}`)}
                </span>
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-[11px] font-semibold uppercase tracking-wider text-text-secondary dark:text-neutral-400">{t("transition.comment")}</label>
                <input value={transitionComment} onChange={(e) => setTransitionComment(e.target.value)} placeholder={t("transition.commentPlaceholder")} className="input w-full h-10" />
              </div>
              <div className="flex flex-col gap-2">
                <label className="text-[11px] font-semibold uppercase tracking-wider text-text-secondary dark:text-neutral-400">{t("transition.availableTransitions")}</label>
                <div className="flex flex-wrap gap-2">
                  {(ALLOWED_TRANSITIONS[transitionOffer.status] || [])
                    .filter((target) => permissionsForTransition(transitionOffer.status, target).some((c) => granted.has(c)))
                    .map((target) => (
                    <button key={target} onClick={() => handleTransition(transitionOffer.id, target)} className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-lg bg-neutral-100 dark:bg-neutral-800 text-black dark:text-white hover:bg-neutral-200 dark:hover:bg-neutral-700 transition-colors cursor-pointer">
                      <svg className="size-3" viewBox="0 0 16 16" fill="none"><path d="M6 3l5 5-5 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
                      {t(`status.${target}`)}
                    </button>
                  ))}
                  {(ALLOWED_TRANSITIONS[transitionOffer.status] || [])
                    .filter((target) => permissionsForTransition(transitionOffer.status, target).some((c) => granted.has(c)))
                    .length === 0 && (
                    <p className="text-xs text-text-secondary dark:text-neutral-500">{tc("noResults")}</p>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

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
                  <label className="text-[11px] font-semibold uppercase tracking-wider text-text-secondary dark:text-neutral-400">{t("form.shortDescription")}</label>
                  <input value={form.shortDescription} onChange={(e) => setForm({ ...form, shortDescription: e.target.value })} className="input w-full h-10" />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-[11px] font-semibold uppercase tracking-wider text-text-secondary dark:text-neutral-400">{t("form.longDescription")}</label>
                  <textarea value={form.longDescription} onChange={(e) => setForm({ ...form, longDescription: e.target.value })} rows={3} className="input w-full resize-none" />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="flex flex-col gap-1.5">
                    <label className="text-[11px] font-semibold uppercase tracking-wider text-text-secondary dark:text-neutral-400">{t("form.promotionalPrice")}</label>
                    <input type="number" min="0" value={form.promotionalPrice} onChange={(e) => setForm({ ...form, promotionalPrice: e.target.value })} placeholder="0" className="input w-full h-10" />
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
                <div className="grid grid-cols-2 gap-3">
                  <div className="flex flex-col gap-1.5">
                    <label className="text-[11px] font-semibold uppercase tracking-wider text-text-secondary dark:text-neutral-400">{t("form.targetSegment")}</label>
                    <select value={form.targetSegment} onChange={(e) => setForm({ ...form, targetSegment: e.target.value })} className="input w-full h-10">
                      <option value="">—</option>
                      <option value="PREPAID">{t("segments.PREPAID")}</option>
                      <option value="POSTPAID">{t("segments.POSTPAID")}</option>
                      <option value="HYBRID">{t("segments.HYBRID")}</option>
                    </select>
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label className="text-[11px] font-semibold uppercase tracking-wider text-text-secondary dark:text-neutral-400">{t("form.customerType")}</label>
                    <select value={form.customerType} onChange={(e) => setForm({ ...form, customerType: e.target.value })} className="input w-full h-10">
                      <option value="">—</option>
                      <option value="INDIVIDUAL">{t("customerTypes.INDIVIDUAL")}</option>
                      <option value="BUSINESS">{t("customerTypes.BUSINESS")}</option>
                      <option value="ALL">{t("customerTypes.ALL")}</option>
                    </select>
                  </div>
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-[11px] font-semibold uppercase tracking-wider text-text-secondary dark:text-neutral-400">{t("form.legalMentions")}</label>
                  <input value={form.legalMentions} onChange={(e) => setForm({ ...form, legalMentions: e.target.value })} className="input w-full h-10" />
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
      {detailOffer && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm px-4" onClick={(e) => { if (e.target === e.currentTarget) setDetailOffer(null); }}>
          <div className="bg-white dark:bg-neutral-900 border border-border dark:border-neutral-800 rounded-2xl shadow-xl w-full max-w-md overflow-hidden animate-fade-in">
            <div className="flex items-center justify-between px-6 py-4 border-b border-border dark:border-neutral-800">
              <div className="flex items-center gap-3">
                <div className="size-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
                  <svg className="size-5" viewBox="0 0 16 16" fill="none"><rect x="2" y="1" width="12" height="14" rx="2" stroke="currentColor" strokeWidth="1.5" /><path d="M5 5h6M5 8h4M5 11h2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" /></svg>
                </div>
                <div>
                  <h2 className="text-base font-bold text-black dark:text-white">{detailOffer.name}</h2>
                  <p className="text-xs text-text-secondary dark:text-neutral-500">{detailOffer.shortDescription || "—"}</p>
                </div>
              </div>
              <button onClick={() => setDetailOffer(null)} className="p-1.5 rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors cursor-pointer">
                <svg className="size-4 text-neutral-500" viewBox="0 0 16 16" fill="none"><path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" /></svg>
              </button>
            </div>
            <div className="px-6 py-5 flex flex-col gap-5 max-h-[60vh] overflow-y-auto">
              <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col gap-1">
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-text-secondary dark:text-neutral-500">{t("columns.status")}</p>
                  <span className={`inline-flex items-center w-fit px-2 py-0.5 text-[11px] font-semibold rounded-md ${STATUS_STYLES[detailOffer.status]}`}>{t(`status.${detailOffer.status}`)}</span>
                </div>
                <div className="flex flex-col gap-1">
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-text-secondary dark:text-neutral-500">{t("columns.quality")}</p>
                  <div className="flex items-center gap-2">
                    <div className="flex-1 h-2 bg-neutral-200 dark:bg-neutral-700 rounded-full overflow-hidden">
                      <div className={`h-full rounded-full ${detailOffer.qualityScore >= 80 ? "bg-emerald-500" : detailOffer.qualityScore >= 50 ? "bg-amber-500" : "bg-red-500"}`} style={{ width: `${Math.min(detailOffer.qualityScore, 100)}%` }} />
                    </div>
                    <span className="text-sm font-bold text-black dark:text-white tabular-nums">{detailOffer.qualityScore}%</span>
                  </div>
                </div>
                <div className="flex flex-col gap-1">
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-text-secondary dark:text-neutral-500">{t("columns.price")}</p>
                  <p className="text-sm font-bold text-black dark:text-white">{detailOffer.promotionalPrice ? formatPrice(detailOffer.promotionalPrice, detailOffer.currency) : "—"}</p>
                </div>
                <div className="flex flex-col gap-1">
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-text-secondary dark:text-neutral-500">{t("detail.version")}</p>
                  <p className="text-sm font-bold text-black dark:text-white">v{detailOffer.currentVersion}</p>
                </div>
                <div className="flex flex-col gap-1">
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-text-secondary dark:text-neutral-500">{t("form.targetSegment")}</p>
                  <p className="text-sm font-medium text-black dark:text-white">{detailOffer.targetSegment ? t(`segments.${detailOffer.targetSegment}`) : "—"}</p>
                </div>
                <div className="flex flex-col gap-1">
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-text-secondary dark:text-neutral-500">{t("form.customerType")}</p>
                  <p className="text-sm font-medium text-black dark:text-white">{detailOffer.customerType ? t(`customerTypes.${detailOffer.customerType}`) : "—"}</p>
                </div>
                <div className="flex flex-col gap-1">
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-text-secondary dark:text-neutral-500">{t("columns.created")}</p>
                  <p className="text-sm font-medium text-black dark:text-white">{formatDate(detailOffer.createdAt)}</p>
                </div>
                <div className="flex flex-col gap-1">
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-text-secondary dark:text-neutral-500">{t("detail.updatedAt")}</p>
                  <p className="text-sm font-medium text-black dark:text-white">{formatDate(detailOffer.updatedAt)}</p>
                </div>
              </div>
              {detailOffer.longDescription && (
                <div className="flex flex-col gap-1">
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-text-secondary dark:text-neutral-500">{t("form.longDescription")}</p>
                  <p className="text-sm text-black dark:text-white leading-relaxed">{detailOffer.longDescription}</p>
                </div>
              )}
              {detailOffer.legalMentions && (
                <div className="flex flex-col gap-1">
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-text-secondary dark:text-neutral-500">{t("form.legalMentions")}</p>
                  <p className="text-xs text-text-secondary dark:text-neutral-400">{detailOffer.legalMentions}</p>
                </div>
              )}
            </div>
            <div className="flex items-center justify-end gap-2 px-6 py-4 border-t border-border dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-800/30">
              <button onClick={() => { setTransitionOffer(detailOffer); setDetailOffer(null); }} className="secondary-icon px-4 py-2 active-scale">
                <span className="flex items-center gap-1.5">
                  <svg className="size-3.5" viewBox="0 0 16 16" fill="none"><path d="M3 8h10M10 5l3 3-3 3" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" /></svg>
                  <p className="text-sm font-medium">{t("transition.title")}</p>
                </span>
              </button>
              <button onClick={() => { openEditModal(detailOffer); setDetailOffer(null); }} className="secondary-icon px-4 py-2 active-scale">
                <span className="flex items-center gap-1.5">
                  <svg className="size-3.5" viewBox="0 0 16 16" fill="none"><path d="M11.5 1.5l3 3-9 9H2.5v-3l9-9z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" /></svg>
                  <p className="text-sm font-medium">{tc("edit")}</p>
                </span>
              </button>
              <button onClick={() => setDetailOffer(null)} className="tertiary-icon px-4 py-2 active-scale">
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
