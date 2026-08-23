"use client";

import { useEffect, useState, useMemo } from "react";
import api, { apiError } from "@/lib/api";
import type { IntegrationExport, Offer } from "@/lib/types";
import toast from "react-hot-toast";
import { useTranslations } from "next-intl";

const STATUS_STYLES: Record<string, string> = {
  PENDING: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
  SUCCESS: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400",
  FAILED: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
};

const STATUS_ICONS: Record<string, React.ReactNode> = {
  PENDING: (
    <svg className="size-5" viewBox="0 0 20 20" fill="none"><circle cx="10" cy="10" r="7.5" stroke="currentColor" strokeWidth="1.3" /><path d="M10 6v4l2.5 2.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" /></svg>
  ),
  SUCCESS: (
    <svg className="size-5" viewBox="0 0 20 20" fill="none"><circle cx="10" cy="10" r="7.5" stroke="currentColor" strokeWidth="1.3" /><path d="M7 10l2 2 4-4" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" /></svg>
  ),
  FAILED: (
    <svg className="size-5" viewBox="0 0 20 20" fill="none"><circle cx="10" cy="10" r="7.5" stroke="currentColor" strokeWidth="1.3" /><path d="M7.5 7.5l5 5M12.5 7.5l-5 5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" /></svg>
  ),
};

const SYSTEMS = ["CRM", "CALL_CENTER", "WEBSITE"] as const;
const EXPORT_TYPES = ["AUTO_PUBLISH", "MANUAL_EXPORT", "RESYNC", "CATALOG_EXPORT"] as const;

const PER_PAGE = 10;

function Skeleton({ className }: { className: string }) {
  return <div className={`rounded-lg bg-neutral-100 dark:bg-neutral-800 animate-pulse ${className}`} />;
}

export default function ExportsPage() {
  const t = useTranslations("exports");
  const tc = useTranslations("common");

  const [exports, setExports] = useState<IntegrationExport[]>([]);
  const [offers, setOffers] = useState<Offer[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [filterSystem, setFilterSystem] = useState("");
  const [filterType, setFilterType] = useState("");
  const [page, setPage] = useState(1);

  const [showModal, setShowModal] = useState(false);
  const [triggering, setTriggering] = useState(false);
  const [form, setForm] = useState({ offerId: "", targetSystem: "", exportType: "" });

  useEffect(() => { loadExports(); loadOffers(); }, []);
  useEffect(() => { setPage(1); }, [search, filterStatus, filterSystem, filterType]);

  useEffect(() => {
    function handleEscape(e: KeyboardEvent) {
      if (e.key === "Escape" && showModal) { setShowModal(false); resetForm(); }
    }
    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [showModal]);

  async function loadExports() {
    try {
      const { data } = await api.get("/exports");
      setExports(Array.isArray(data) ? data : data.content ?? []);
    } catch (e) { toast.error(apiError(e, tc("errors.load"))); }
    finally { setLoading(false); }
  }

  async function loadOffers() {
    try { const { data } = await api.get("/offers"); setOffers(Array.isArray(data) ? data : data.content ?? []); }
    catch { /* */ }
  }

  function resetForm() { setForm({ offerId: "", targetSystem: "", exportType: "" }); }

  async function handleTrigger(e: React.FormEvent) {
    e.preventDefault();
    if (triggering) return;
    setTriggering(true);
    try {
      // POST /exports/trigger attend des query params, pas un body JSON.
      await api.post("/exports/trigger", null, {
        params: { offerId: form.offerId, targetSystem: form.targetSystem, exportType: form.exportType },
      });
      toast.success(t("messages.triggered"));
      setShowModal(false); resetForm(); loadExports();
    } catch (e) {
      toast.error(apiError(e, tc("errors.action")));
    } finally { setTriggering(false); }
  }

  function formatDate(dateStr: string): string {
    const d = new Date(dateStr);
    return d.toLocaleDateString(undefined, { day: "2-digit", month: "2-digit", year: "numeric" }) + " " + d.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
  }

  function offerName(offerId: string) {
    return offers.find((o) => o.id === offerId)?.name ?? offerId.slice(0, 8) + "...";
  }

  const filtered = useMemo(() => {
    return exports.filter((ex) => {
      if (filterStatus && ex.status !== filterStatus) return false;
      if (filterSystem && ex.targetSystem !== filterSystem) return false;
      if (filterType && ex.exportType !== filterType) return false;
      if (search) {
        const q = search.toLowerCase();
        if (!(ex.offerId || "").toLowerCase().includes(q) && !(ex.targetSystem || "").toLowerCase().includes(q) && !(ex.exportType || "").toLowerCase().includes(q)) return false;
      }
      return true;
    });
  }, [exports, filterStatus, filterSystem, filterType, search]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PER_PAGE));
  const paginated = filtered.slice((page - 1) * PER_PAGE, page * PER_PAGE);

  const stats = useMemo(() => ({
    pending: exports.filter((e) => e.status === "PENDING").length,
    success: exports.filter((e) => e.status === "SUCCESS").length,
    failed: exports.filter((e) => e.status === "FAILED").length,
  }), [exports]);

  const statCards = [
    {
      label: t("stats.pending"), value: stats.pending,
      color: "text-amber-600 dark:text-amber-400", bg: "bg-amber-100 dark:bg-amber-900/30",
      icon: (<svg className="size-6" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.5" /><path d="M12 7v5l3 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>),
    },
    {
      label: t("stats.success"), value: stats.success,
      color: "text-emerald-600 dark:text-emerald-400", bg: "bg-emerald-100 dark:bg-emerald-900/30",
      icon: (<svg className="size-6" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.5" /><path d="M8 12l3 3 5-5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>),
    },
    {
      label: t("stats.failed"), value: stats.failed,
      color: "text-red-600 dark:text-red-400", bg: "bg-red-100 dark:bg-red-900/30",
      icon: (<svg className="size-6" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.5" /><path d="M8 8l8 8M16 8l-8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" /></svg>),
    },
  ];

  return (
    <div className="flex flex-col gap-6 pb-8">

      {/* ===== HEADER ===== */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-black dark:text-white">{t("title")}</h1>
          <p className="text-sm text-text-secondary dark:text-neutral-500 mt-1">{t("subtitle")}</p>
        </div>
        <button onClick={() => setShowModal(true)} className="primary-icon px-4 py-2.5 active-scale">
          <span className="flex items-center gap-2">
            <svg className="size-4" viewBox="0 0 16 16" fill="none">
              <path d="M4 10v3a1 1 0 001 1h6a1 1 0 001-1v-3" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
              <path d="M8 2v8M5.5 4.5L8 2l2.5 2.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            <p className="text-sm font-medium">{t("triggerExport")}</p>
          </span>
        </button>
      </div>

      {/* ===== 3 STAT CARDS ===== */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {statCards.map((card) => (
          <div key={card.label} className="rounded-2xl border border-border dark:border-neutral-800 bg-white dark:bg-neutral-900 p-5 shadow-card">
            <div className="flex items-center gap-3 mb-3">
              <div className={`rounded-xl p-2.5 ${card.bg} ${card.color}`}>{card.icon}</div>
              <span className="text-sm font-medium text-text-secondary dark:text-neutral-400">{card.label}</span>
            </div>
            {loading ? <Skeleton className="w-10 h-8" /> : (
              <span className="text-3xl font-bold text-black dark:text-white tabular-nums block">{card.value}</span>
            )}
          </div>
        ))}
      </div>

      {/* ===== FILTRES ===== */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-neutral-400" viewBox="0 0 16 16" fill="none">
            <circle cx="7" cy="7" r="5" stroke="currentColor" strokeWidth="1.3" />
            <path d="M11 11l3.5 3.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
          </svg>
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder={t("columns.offerId") + ", " + t("columns.system") + "..."} className="input w-full h-10 pl-9" />
        </div>
        <div className="relative">
          <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} className="input h-10 min-w-[140px] appearance-none cursor-pointer">
            <option value="">{t("allStatuses")}</option>
            <option value="PENDING">{t("status.PENDING")}</option>
            <option value="SUCCESS">{t("status.SUCCESS")}</option>
            <option value="FAILED">{t("status.FAILED")}</option>
          </select>
          <svg className="absolute right-3 top-1/2 -translate-y-1/2 size-3.5 text-neutral-400 pointer-events-none" viewBox="0 0 12 12" fill="none"><path d="M3 4.5l3 3 3-3" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" /></svg>
        </div>
        <div className="relative">
          <select value={filterSystem} onChange={(e) => setFilterSystem(e.target.value)} className="input h-10 min-w-[140px] appearance-none cursor-pointer">
            <option value="">{t("allSystems")}</option>
            {SYSTEMS.map((s) => <option key={s} value={s}>{t(`targetSystem.${s}`)}</option>)}
          </select>
          <svg className="absolute right-3 top-1/2 -translate-y-1/2 size-3.5 text-neutral-400 pointer-events-none" viewBox="0 0 12 12" fill="none"><path d="M3 4.5l3 3 3-3" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" /></svg>
        </div>
        <div className="relative">
          <select value={filterType} onChange={(e) => setFilterType(e.target.value)} className="input h-10 min-w-[160px] appearance-none cursor-pointer">
            <option value="">{t("allTypes")}</option>
            {EXPORT_TYPES.map((et) => <option key={et} value={et}>{t(`exportType.${et}`)}</option>)}
          </select>
          <svg className="absolute right-3 top-1/2 -translate-y-1/2 size-3.5 text-neutral-400 pointer-events-none" viewBox="0 0 12 12" fill="none"><path d="M3 4.5l3 3 3-3" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" /></svg>
        </div>
      </div>

      {/* ===== TABLEAU ===== */}
      <div className="rounded-2xl border border-border dark:border-neutral-800 bg-white dark:bg-neutral-900 shadow-card overflow-hidden">
        <div className="hidden md:grid grid-cols-[1fr_1fr_120px_90px_80px_140px_140px] gap-3 px-6 py-3 bg-blue-600 dark:bg-blue-700 rounded-t-2xl">
          {[t("columns.system"), t("columns.offerId"), t("columns.type"), t("columns.status"), t("columns.retries"), t("columns.createdAt"), t("columns.completedAt")].map((col, i) => (
            <span key={i} className="text-[11px] font-semibold uppercase tracking-wider text-white">{col}</span>
          ))}
        </div>

        {loading ? (
          <div className="px-6 py-4 flex flex-col gap-1">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="hidden md:grid grid-cols-[1fr_1fr_120px_90px_80px_140px_140px] gap-3 items-center py-3.5">
                <Skeleton className="w-24 h-4" /><Skeleton className="w-20 h-4" /><Skeleton className="w-20 h-5 !rounded-md" /><Skeleton className="w-16 h-5 !rounded-md" /><Skeleton className="w-8 h-4" /><Skeleton className="w-28 h-4" /><Skeleton className="w-28 h-4" />
              </div>
            ))}
          </div>
        ) : paginated.length === 0 ? (
          <div className="px-6 py-16 text-center">
            <div className="flex flex-col items-center gap-5">
              <svg className="size-28" viewBox="0 0 120 120" fill="none">
                <rect x="25" y="20" width="70" height="80" rx="8" className="fill-blue-50 dark:fill-blue-900/15 stroke-blue-200 dark:stroke-blue-800/30" strokeWidth="1.5" />
                <path d="M60 40v20M53 47l7-7 7 7" className="stroke-blue-300 dark:stroke-blue-700/50" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                <path d="M40 75h40" className="stroke-blue-200 dark:stroke-blue-800/30" strokeWidth="1.5" strokeLinecap="round" />
                <path d="M40 85h25" className="stroke-blue-200 dark:stroke-blue-800/30" strokeWidth="1.5" strokeLinecap="round" />
                <circle cx="90" cy="30" r="2.5" className="fill-primary/20" />
                <circle cx="30" cy="95" r="2" className="fill-emerald-400/25" />
              </svg>
              <div>
                <p className="text-base font-bold text-black dark:text-white">{t("empty")}</p>
                <p className="text-sm text-text-secondary dark:text-neutral-500 mt-2 max-w-md mx-auto leading-relaxed">{t("emptyDescription")}</p>
              </div>
              <button onClick={() => setShowModal(true)} className="primary-icon px-5 py-2.5 active-scale mt-1">
                <span className="flex items-center gap-2">
                  <svg className="size-4" viewBox="0 0 16 16" fill="none">
                    <path d="M4 10v3a1 1 0 001 1h6a1 1 0 001-1v-3" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
                    <path d="M8 2v8M5.5 4.5L8 2l2.5 2.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                  <p className="text-sm font-medium">{t("triggerExport")}</p>
                </span>
              </button>
            </div>
          </div>
        ) : (
          <div className="divide-y divide-border dark:divide-neutral-800">
            {paginated.map((ex) => (
              <div key={ex.id} className="grid grid-cols-1 md:grid-cols-[1fr_1fr_120px_90px_80px_140px_140px] gap-2 md:gap-3 items-center px-6 py-3.5 hover:bg-neutral-50 dark:hover:bg-neutral-800/30 transition-colors">
                <div className="flex items-center gap-3 min-w-0">
                  <div className={`size-9 rounded-xl flex items-center justify-center shrink-0 ${STATUS_STYLES[ex.status] ?? STATUS_STYLES.PENDING}`}>
                    {STATUS_ICONS[ex.status] ?? STATUS_ICONS.PENDING}
                  </div>
                  <span className="text-sm font-semibold text-black dark:text-white truncate">{t(`targetSystem.${ex.targetSystem}`)}</span>
                </div>
                <span className="text-xs text-text-secondary dark:text-neutral-400 font-mono truncate" title={ex.offerId}>{offerName(ex.offerId)}</span>
                <span className="inline-flex items-center w-fit px-2.5 py-0.5 text-[11px] font-medium rounded-md bg-neutral-100 text-neutral-600 dark:bg-neutral-800 dark:text-neutral-400">{t(`exportType.${ex.exportType}`)}</span>
                <span className={`inline-flex items-center w-fit px-2.5 py-0.5 text-[11px] font-semibold rounded-md ${STATUS_STYLES[ex.status] ?? STATUS_STYLES.PENDING}`}>
                  {t(`status.${ex.status}`)}
                </span>
                <span className="text-xs text-text-secondary dark:text-neutral-400 tabular-nums text-center">{ex.retryCount}</span>
                <span className="text-xs text-text-secondary dark:text-neutral-400">{formatDate(ex.createdAt)}</span>
                <span className="text-xs text-text-secondary dark:text-neutral-400">{ex.completedAt ? formatDate(ex.completedAt) : t("notCompleted")}</span>
              </div>
            ))}
          </div>
        )}

        {/* Pagination */}
        {filtered.length > PER_PAGE && (
          <div className="flex items-center justify-between px-6 py-3 border-t border-border dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-800/20">
            <span className="text-xs text-text-secondary dark:text-neutral-500">
              {t("pagination.showing", { from: (page - 1) * PER_PAGE + 1, to: Math.min(page * PER_PAGE, filtered.length), total: filtered.length })}
            </span>
            <div className="flex items-center gap-1">
              <button onClick={() => setPage(Math.max(1, page - 1))} disabled={page === 1} className="size-8 rounded-lg flex items-center justify-center border border-border dark:border-neutral-700 hover:bg-neutral-100 dark:hover:bg-neutral-700 transition-colors disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer">
                <svg className="size-3.5 text-neutral-600 dark:text-neutral-300" viewBox="0 0 12 12" fill="none"><path d="M7.5 2.5L4 6l3.5 3.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" /></svg>
              </button>
              {Array.from({ length: Math.min(totalPages, 7) }, (_, i) => {
                let p: number;
                if (totalPages <= 7) { p = i + 1; }
                else if (page <= 4) { p = i + 1; }
                else if (page >= totalPages - 3) { p = totalPages - 6 + i; }
                else { p = page - 3 + i; }
                return (
                  <button key={p} onClick={() => setPage(p)} className={`size-8 rounded-lg flex items-center justify-center text-xs font-medium transition-colors cursor-pointer ${page === p ? "bg-primary text-white" : "border border-border dark:border-neutral-700 text-neutral-600 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-700"}`}>{p}</button>
                );
              })}
              <button onClick={() => setPage(Math.min(totalPages, page + 1))} disabled={page === totalPages} className="size-8 rounded-lg flex items-center justify-center border border-border dark:border-neutral-700 hover:bg-neutral-100 dark:hover:bg-neutral-700 transition-colors disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer">
                <svg className="size-3.5 text-neutral-600 dark:text-neutral-300" viewBox="0 0 12 12" fill="none"><path d="M4.5 2.5L8 6l-3.5 3.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" /></svg>
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ===== MODAL TRIGGER EXPORT ===== */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm px-4" onClick={(e) => { if (e.target === e.currentTarget) { setShowModal(false); resetForm(); } }}>
          <div className="bg-white dark:bg-neutral-900 border border-border dark:border-neutral-800 rounded-2xl shadow-xl w-full max-w-md overflow-hidden animate-fade-in">
            <div className="flex items-center justify-between px-6 py-4 border-b border-border dark:border-neutral-800">
              <h2 className="text-base font-bold text-black dark:text-white">{t("triggerTitle")}</h2>
              <button onClick={() => { setShowModal(false); resetForm(); }} className="p-1.5 rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors cursor-pointer">
                <svg className="size-4 text-neutral-500" viewBox="0 0 16 16" fill="none"><path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" /></svg>
              </button>
            </div>
            <form onSubmit={handleTrigger}>
              <div className="px-6 py-5 flex flex-col gap-4">
                <div className="flex flex-col gap-1.5">
                  <label className="text-[11px] font-semibold uppercase tracking-wider text-text-secondary dark:text-neutral-400">{t("columns.offerId")}</label>
                  <select required value={form.offerId} onChange={(e) => setForm({ ...form, offerId: e.target.value })} className="input w-full h-10">
                    <option value="">{t("form.selectOffer")}</option>
                    {offers.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
                  </select>
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-[11px] font-semibold uppercase tracking-wider text-text-secondary dark:text-neutral-400">{t("columns.system")}</label>
                  <select required value={form.targetSystem} onChange={(e) => setForm({ ...form, targetSystem: e.target.value })} className="input w-full h-10">
                    <option value="">{t("form.selectSystem")}</option>
                    {SYSTEMS.map((s) => <option key={s} value={s}>{t(`targetSystem.${s}`)}</option>)}
                  </select>
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-[11px] font-semibold uppercase tracking-wider text-text-secondary dark:text-neutral-400">{t("columns.type")}</label>
                  <select required value={form.exportType} onChange={(e) => setForm({ ...form, exportType: e.target.value })} className="input w-full h-10">
                    <option value="">{t("form.selectType")}</option>
                    {EXPORT_TYPES.map((et) => <option key={et} value={et}>{t(`exportType.${et}`)}</option>)}
                  </select>
                </div>
              </div>
              <div className="flex items-center justify-end gap-2 px-6 py-4 border-t border-border dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-800/30">
                <button type="button" onClick={() => { setShowModal(false); resetForm(); }} className="tertiary-icon px-4 py-2 active-scale">
                  <p className="text-sm font-medium">{tc("cancel")}</p>
                </button>
                <button type="submit" disabled={triggering} className="primary-icon px-5 py-2 active-scale disabled:opacity-60">
                  <span className="flex items-center gap-2">
                    {triggering && <div className="size-4 animate-spin rounded-full border-2 border-white border-t-transparent" />}
                    <p className="text-sm font-medium">{triggering ? tc("saving") : t("triggerExport")}</p>
                  </span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
