"use client";

import { useEffect, useState } from "react";
import api from "@/lib/api";
import type { AuditLog } from "@/lib/types";

const ACTION_LABELS: Record<string, string> = {
  CREATE: "Création",
  UPDATE: "Modification",
  DELETE: "Suppression",
  VALIDATE: "Validation",
  REJECT: "Rejet",
  PUBLISH: "Publication",
  ROLLBACK: "Rollback",
  LOGIN: "Connexion",
  LOGIN_FAILED: "Échec connexion",
  EXPORT: "Export",
  DATA_ANONYMIZED: "Anonymisation",
  DATA_EXPORT_REQUESTED: "Export RGPD",
};

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

const ENTITY_LABELS: Record<string, string> = {
  OFFER: "Offre",
  CATALOG_ITEM: "Catalogue",
  USER: "Utilisateur",
  CAMPAIGN: "Campagne",
  MEDIA: "Média",
  RULE: "Règle",
  NOTIFICATION: "Notification",
};

const FILTER_ACTIONS = ["ALL", "CREATE", "UPDATE", "DELETE", "LOGIN", "LOGIN_FAILED", "VALIDATE", "REJECT", "PUBLISH"] as const;

export default function AuditPage() {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterAction, setFilterAction] = useState("ALL");
  const [filterEntity, setFilterEntity] = useState("");
  const [detailLog, setDetailLog] = useState<AuditLog | null>(null);

  useEffect(() => {
    loadLogs();
  }, []);

  async function loadLogs() {
    try {
      const { data } = await api.get("/audit");
      setLogs(data.content ?? data);
    } catch {
      /* API pas disponible */
    } finally {
      setLoading(false);
    }
  }

  function formatDate(dateStr: string): string {
    const d = new Date(dateStr);
    return d.toLocaleDateString("fr-FR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  function formatJson(val: string | null): string {
    if (!val) return "";
    try {
      return JSON.stringify(JSON.parse(val), null, 2);
    } catch {
      return val;
    }
  }

  const filtered = logs.filter((log) => {
    if (filterAction !== "ALL" && log.action !== filterAction) return false;
    if (filterEntity && log.entityType !== filterEntity) return false;
    if (search) {
      const q = search.toLowerCase();
      return (
        (log.userId || "").toLowerCase().includes(q) ||
        (log.entityType || "").toLowerCase().includes(q) ||
        (log.action || "").toLowerCase().includes(q) ||
        (log.ipAddress || "").toLowerCase().includes(q)
      );
    }
    return true;
  });

  const actionCounts = logs.reduce<Record<string, number>>((acc, log) => {
    acc[log.action] = (acc[log.action] || 0) + 1;
    return acc;
  }, {});

  const entityTypes = [...new Set(logs.map((l) => l.entityType).filter(Boolean))];

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-black dark:text-white">Audit</h1>
        <p className="text-sm text-text-secondary dark:text-neutral-500 mt-0.5">
          {logs.length} entrée{logs.length > 1 ? "s" : ""} enregistrée{logs.length > 1 ? "s" : ""}
        </p>
      </div>

      {/* Filters */}
      <div className="flex flex-col gap-3">
        <div className="flex items-center gap-3 flex-wrap">
          {/* Search */}
          <div className="relative flex-1 min-w-[200px] max-w-sm">
            <svg className="absolute left-2.5 top-1/2 -translate-y-1/2 size-4 text-neutral-400" viewBox="0 0 16 16" fill="none">
              <circle cx="7" cy="7" r="4.5" stroke="currentColor" strokeWidth="1.3" />
              <path d="M10.5 10.5L14 14" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
            </svg>
            <input
              type="text"
              placeholder="Rechercher..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="input w-full pl-8"
            />
          </div>

          {/* Entity type filter */}
          <select
            value={filterEntity}
            onChange={(e) => setFilterEntity(e.target.value)}
            className="input"
          >
            <option value="">Toutes les entités</option>
            {entityTypes.map((et) => (
              <option key={et} value={et}>
                {ENTITY_LABELS[et] || et}
              </option>
            ))}
          </select>
        </div>

        {/* Action filter pills */}
        <div className="flex gap-1 flex-wrap">
          {FILTER_ACTIONS.map((action) => (
            <button
              key={action}
              onClick={() => setFilterAction(action)}
              className={`px-3 py-1.5 text-xs font-medium transition-all cursor-pointer ${
                filterAction === action
                  ? "bg-black text-white dark:bg-white dark:text-black"
                  : "bg-neutral-100 text-neutral-600 dark:bg-neutral-800 dark:text-neutral-400 hover:bg-neutral-200 dark:hover:bg-neutral-700"
              }`}
              style={{ borderRadius: 6 }}
            >
              {action === "ALL" ? "Toutes" : ACTION_LABELS[action] || action}
              <span className="ml-1 opacity-60">
                {action === "ALL" ? logs.length : actionCounts[action] || 0}
              </span>
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
                <th className="text-left px-4 py-3 font-semibold text-xs uppercase tracking-wider first:rounded-tl-2xl">Date</th>
                <th className="text-left px-4 py-3 font-semibold text-xs uppercase tracking-wider">Action</th>
                <th className="text-left px-4 py-3 font-semibold text-xs uppercase tracking-wider">Entité</th>
                <th className="text-left px-4 py-3 font-semibold text-xs uppercase tracking-wider">IP</th>
                <th className="text-left px-4 py-3 font-semibold text-xs uppercase tracking-wider last:rounded-tr-2xl">Détails</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border dark:divide-neutral-800">
              {loading ? (
                [...Array(5)].map((_, i) => (
                  <tr key={i}>
                    {[...Array(5)].map((__, j) => (
                      <td key={j} className="px-4 py-3">
                        <div className="w-24 h-4 rounded bg-neutral-100 dark:bg-neutral-800 animate-pulse" />
                      </td>
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
                      <p className="text-sm text-text-secondary dark:text-neutral-500">
                        Aucune entrée d&apos;audit
                      </p>
                    </div>
                  </td>
                </tr>
              ) : (
                filtered.map((log) => (
                  <tr key={log.id} className="hover:bg-neutral-50 dark:hover:bg-neutral-800/30 transition-colors">
                    <td className="px-4 py-3">
                      <p className="text-xs text-text-secondary dark:text-neutral-400 whitespace-nowrap">{formatDate(log.createdAt)}</p>
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 text-[11px] font-medium ${ACTION_COLORS[log.action] || "bg-neutral-100 text-neutral-700 dark:bg-neutral-800 dark:text-neutral-400"}`}
                        style={{ borderRadius: 4 }}
                      >
                        {ACTION_LABELS[log.action] || log.action}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="font-bold text-black dark:text-white text-xs">
                        {ENTITY_LABELS[log.entityType] || log.entityType}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-xs text-text-secondary dark:text-neutral-400 font-mono">
                        {log.ipAddress || "·"}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {(log.previousValue || log.newValue) ? (
                        <button
                          onClick={() => setDetailLog(log)}
                          className="p-1.5 rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
                          title="Voir les détails"
                        >
                          <svg className="size-4 text-black dark:text-white" viewBox="0 0 16 16" fill="none">
                            <circle cx="8" cy="8" r="6.5" stroke="currentColor" strokeWidth="1.3" />
                            <path d="M8 5v.5M8 7v4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                          </svg>
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
      </div>

      {/* Detail modal */}
      {detailLog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50" onClick={() => setDetailLog(null)}>
          <div
            className="bg-white dark:bg-neutral-900 rounded-2xl border border-border dark:border-neutral-800 shadow-xl w-full max-w-2xl max-h-[80vh] overflow-hidden animate-fade-in"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-6 py-4 border-b border-border dark:border-neutral-800">
              <div>
                <h3 className="text-lg font-bold text-black dark:text-white">Détails de l&apos;audit</h3>
                <p className="text-xs text-text-secondary dark:text-neutral-500 mt-0.5">
                  {ACTION_LABELS[detailLog.action] || detailLog.action} · {ENTITY_LABELS[detailLog.entityType] || detailLog.entityType} · {formatDate(detailLog.createdAt)}
                </p>
              </div>
              <button onClick={() => setDetailLog(null)} className="p-1.5 rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors">
                <svg className="size-5 text-black dark:text-white" viewBox="0 0 16 16" fill="none">
                  <path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                </svg>
              </button>
            </div>
            <div className="p-6 overflow-y-auto max-h-[60vh] flex flex-col gap-5">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-text-secondary dark:text-neutral-500 uppercase tracking-wider mb-1">Utilisateur ID</label>
                  <p className="text-sm font-bold text-black dark:text-white font-mono break-all">{detailLog.userId}</p>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-text-secondary dark:text-neutral-500 uppercase tracking-wider mb-1">Entité ID</label>
                  <p className="text-sm font-bold text-black dark:text-white font-mono break-all">{detailLog.entityId || "·"}</p>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-text-secondary dark:text-neutral-500 uppercase tracking-wider mb-1">Adresse IP</label>
                  <p className="text-sm font-bold text-black dark:text-white font-mono">{detailLog.ipAddress || "·"}</p>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-text-secondary dark:text-neutral-500 uppercase tracking-wider mb-1">User Agent</label>
                  <p className="text-xs text-text-secondary dark:text-neutral-400 break-all line-clamp-2">{detailLog.userAgent || "·"}</p>
                </div>
              </div>

              {detailLog.previousValue && (
                <div>
                  <label className="block text-xs font-semibold text-text-secondary dark:text-neutral-500 uppercase tracking-wider mb-1.5">Valeur précédente</label>
                  <pre className="text-xs text-black dark:text-white bg-neutral-50 dark:bg-neutral-800 p-3 rounded-lg overflow-x-auto font-mono">{formatJson(detailLog.previousValue)}</pre>
                </div>
              )}

              {detailLog.newValue && (
                <div>
                  <label className="block text-xs font-semibold text-text-secondary dark:text-neutral-500 uppercase tracking-wider mb-1.5">Nouvelle valeur</label>
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
