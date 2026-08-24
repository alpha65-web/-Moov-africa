"use client";

import { useEffect, useState } from "react";
import api from "@/lib/api";
import { searchKeyHandler } from "@/lib/search";
import type { AuditLog } from "@/lib/types";
import { useTranslations } from "next-intl";

const ACTION_COLORS: Record<string, string> = {
  CREATE: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400",
  UPDATE: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
  DELETE: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
  VALIDATE: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
  REJECT: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
  PUBLISH: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400",
  ROLLBACK: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400",
  LOGIN: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400",
  LOGIN_FAILED: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
  EXPORT: "bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-400",
  DATA_ANONYMIZED: "bg-neutral-100 text-neutral-700 dark:bg-neutral-800 dark:text-neutral-400",
  DATA_EXPORT_REQUESTED: "bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-400",
};

const FILTER_ACTIONS = ["ALL", "CREATE", "UPDATE", "DELETE", "LOGIN", "LOGIN_FAILED", "VALIDATE", "REJECT", "PUBLISH"] as const;

const PER_PAGE = 10;

export default function AuditPage() {
  const t = useTranslations("audit");

  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterAction, setFilterAction] = useState("ALL");
  const [filterEntity, setFilterEntity] = useState("");
  const [detailLog, setDetailLog] = useState<AuditLog | null>(null);
  const [page, setPage] = useState(1);

  useEffect(() => { loadLogs(); }, []);

  useEffect(() => {
    function handleEscape(e: KeyboardEvent) {
      if (e.key === "Escape" && detailLog) setDetailLog(null);
    }
    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [detailLog]);

  useEffect(() => { setPage(1); }, [search, filterAction, filterEntity]);

  async function loadLogs() {
    try { const { data } = await api.get("/audit", { params: { size: 500 } }); setLogs(data.content ?? data); }
    catch { /* API pas disponible */ }
    finally { setLoading(false); }
  }

  function formatDate(dateStr: string): string {
    const d = new Date(dateStr);
    return d.toLocaleDateString(undefined, { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
  }

  function formatJson(val: string | null): string {
    if (!val) return "";
    try { return JSON.stringify(JSON.parse(val), null, 2); }
    catch { return val; }
  }

  const filtered = logs.filter((log) => {
    if (filterAction !== "ALL" && log.action !== filterAction) return false;
    if (filterEntity && log.entityType !== filterEntity) return false;
    if (search) {
      const q = search.toLowerCase();
      return (log.userId || "").toLowerCase().includes(q) || (log.entityType || "").toLowerCase().includes(q) || (log.action || "").toLowerCase().includes(q) || (log.ipAddress || "").toLowerCase().includes(q);
    }
    return true;
  });

  const totalPages = Math.ceil(filtered.length / PER_PAGE);
  const paginated = filtered.slice((page - 1) * PER_PAGE, page * PER_PAGE);

  const actionCounts = logs.reduce<Record<string, number>>((acc, log) => { acc[log.action] = (acc[log.action] || 0) + 1; return acc; }, {});
  const entityTypes = [...new Set(logs.map((l) => l.entityType).filter(Boolean))];

  return (
    <div className="flex flex-col gap-6 pb-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-black dark:text-white">{t("title")}</h1>
        <p className="text-sm text-text-secondary dark:text-neutral-500 mt-1">
          {logs.length > 1 ? t("entryCountPlural", { count: logs.length }) : t("entryCount", { count: logs.length })}
        </p>
      </div>

      {/* Filters */}
      <div className="flex flex-col gap-3">
        <div className="flex items-center gap-3 flex-wrap">
          <div className="relative flex-1 min-w-[200px] max-w-sm">
            <svg className="absolute left-2.5 top-1/2 -translate-y-1/2 size-4 text-neutral-400" viewBox="0 0 16 16" fill="none">
              <circle cx="7" cy="7" r="4.5" stroke="currentColor" strokeWidth="1.3" />
              <path d="M10.5 10.5L14 14" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
            </svg>
            <input type="text" placeholder={t("searchPlaceholder")} value={search} onChange={(e) => setSearch(e.target.value)} onKeyDown={searchKeyHandler(setSearch)} className="input w-full pl-8" />
          </div>
          <select value={filterEntity} onChange={(e) => setFilterEntity(e.target.value)} className="input">
            <option value="">{t("allEntities")}</option>
            {entityTypes.map((et) => (
              <option key={et} value={et}>{t(`entities.${et}`)}</option>
            ))}
          </select>
        </div>

        <div className="flex gap-1 flex-wrap">
          {FILTER_ACTIONS.map((action) => (
            <button key={action} onClick={() => setFilterAction(action)} className={`px-3 py-1.5 text-xs font-medium transition-all cursor-pointer ${filterAction === action ? "bg-black text-white dark:bg-white dark:text-black" : "bg-neutral-100 text-neutral-600 dark:bg-neutral-800 dark:text-neutral-400 hover:bg-neutral-200 dark:hover:bg-neutral-700"}`} style={{ borderRadius: 6 }}>
              {action === "ALL" ? t("allActions") : t(`actions.${action}`)}
              <span className="ml-1 opacity-60">{action === "ALL" ? logs.length : actionCounts[action] || 0}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="rounded-2xl border border-border dark:border-neutral-800 bg-white dark:bg-neutral-900 shadow-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-blue-600 dark:bg-blue-700 text-white rounded-t-2xl">
                <th className="text-left px-4 py-3 font-semibold text-xs uppercase tracking-wider first:rounded-tl-2xl">{t("columns.date")}</th>
                <th className="text-left px-4 py-3 font-semibold text-xs uppercase tracking-wider">{t("columns.action")}</th>
                <th className="text-left px-4 py-3 font-semibold text-xs uppercase tracking-wider">{t("columns.entity")}</th>
                <th className="text-left px-4 py-3 font-semibold text-xs uppercase tracking-wider">{t("columns.ip")}</th>
                <th className="text-left px-4 py-3 font-semibold text-xs uppercase tracking-wider last:rounded-tr-2xl">{t("columns.details")}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border dark:divide-neutral-800">
              {loading ? (
                [...Array(5)].map((_, i) => (
                  <tr key={i}>
                    {[...Array(5)].map((__, j) => (
                      <td key={j} className="px-4 py-3"><div className="w-24 h-4 rounded bg-neutral-100 dark:bg-neutral-800 animate-pulse" /></td>
                    ))}
                  </tr>
                ))
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-12 text-center">
                    <div className="flex flex-col items-center gap-3">
                      <div className="size-12 rounded-xl bg-neutral-100 dark:bg-neutral-800 flex items-center justify-center">
                        <svg className="size-6 text-neutral-400" viewBox="0 0 16 16" fill="none">
                          <rect x="2" y="1" width="12" height="14" rx="2" stroke="currentColor" strokeWidth="1.2" />
                          <path d="M5 5h6M5 8h6M5 11h3" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
                        </svg>
                      </div>
                      <p className="text-sm text-text-secondary dark:text-neutral-500">{t("empty")}</p>
                    </div>
                  </td>
                </tr>
              ) : (
                paginated.map((log) => (
                  <tr key={log.id} className="hover:bg-neutral-50 dark:hover:bg-neutral-800/30 transition-colors">
                    <td className="px-4 py-3"><p className="text-xs text-text-secondary dark:text-neutral-400 whitespace-nowrap">{formatDate(log.createdAt)}</p></td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center px-2 py-0.5 text-[11px] font-medium ${ACTION_COLORS[log.action] || "bg-neutral-100 text-neutral-700 dark:bg-neutral-800 dark:text-neutral-400"}`} style={{ borderRadius: 4 }}>
                        {t(`actions.${log.action}`)}
                      </span>
                    </td>
                    <td className="px-4 py-3"><span className="font-bold text-black dark:text-white text-xs">{t(`entities.${log.entityType}`)}</span></td>
                    <td className="px-4 py-3"><span className="text-xs text-text-secondary dark:text-neutral-400 font-mono">{log.ipAddress || "·"}</span></td>
                    <td className="px-4 py-3">
                      {(log.previousValue || log.newValue) ? (
                        <button onClick={() => setDetailLog(log)} className="p-1.5 rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors" title={t("viewDetails")}>
                          <svg className="size-4 text-black dark:text-white" viewBox="0 0 16 16" fill="none"><circle cx="8" cy="8" r="6.5" stroke="currentColor" strokeWidth="1.3" /><path d="M8 5v.5M8 7v4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" /></svg>
                        </button>
                      ) : (
                        <span className="text-xs text-neutral-300 dark:text-neutral-700">·</span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
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

      {/* Detail modal */}
      {detailLog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm" onClick={() => setDetailLog(null)}>
          <div className="bg-white dark:bg-neutral-900 rounded-2xl border border-border dark:border-neutral-800 shadow-xl w-full max-w-2xl max-h-[80vh] overflow-hidden animate-fade-in" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between px-6 py-4 border-b border-border dark:border-neutral-800">
              <div>
                <h3 className="text-lg font-bold text-black dark:text-white">{t("detail")}</h3>
                <p className="text-xs text-text-secondary dark:text-neutral-500 mt-0.5">
                  {t(`actions.${detailLog.action}`)} · {t(`entities.${detailLog.entityType}`)} · {formatDate(detailLog.createdAt)}
                </p>
              </div>
              <button onClick={() => setDetailLog(null)} className="p-1.5 rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors cursor-pointer">
                <svg className="size-5 text-black dark:text-white" viewBox="0 0 16 16" fill="none"><path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" /></svg>
              </button>
            </div>
            <div className="p-6 overflow-y-auto max-h-[60vh] flex flex-col gap-5">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-text-secondary dark:text-neutral-500 uppercase tracking-wider mb-1">{t("userId")}</label>
                  <p className="text-sm font-bold text-black dark:text-white font-mono break-all">{detailLog.userId}</p>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-text-secondary dark:text-neutral-500 uppercase tracking-wider mb-1">{t("entityId")}</label>
                  <p className="text-sm font-bold text-black dark:text-white font-mono break-all">{detailLog.entityId || "·"}</p>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-text-secondary dark:text-neutral-500 uppercase tracking-wider mb-1">{t("ipAddress")}</label>
                  <p className="text-sm font-bold text-black dark:text-white font-mono">{detailLog.ipAddress || "·"}</p>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-text-secondary dark:text-neutral-500 uppercase tracking-wider mb-1">{t("userAgent")}</label>
                  <p className="text-xs text-text-secondary dark:text-neutral-400 break-all line-clamp-2">{detailLog.userAgent || "·"}</p>
                </div>
              </div>
              {detailLog.previousValue && (
                <div>
                  <label className="block text-xs font-semibold text-text-secondary dark:text-neutral-500 uppercase tracking-wider mb-1.5">{t("previousValue")}</label>
                  <pre className="text-xs text-black dark:text-white bg-neutral-50 dark:bg-neutral-800 p-3 rounded-lg overflow-x-auto font-mono">{formatJson(detailLog.previousValue)}</pre>
                </div>
              )}
              {detailLog.newValue && (
                <div>
                  <label className="block text-xs font-semibold text-text-secondary dark:text-neutral-500 uppercase tracking-wider mb-1.5">{t("newValue")}</label>
                  <pre className="text-xs text-black dark:text-white bg-neutral-50 dark:bg-neutral-800 p-3 rounded-lg overflow-x-auto font-mono">{formatJson(detailLog.newValue)}</pre>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
