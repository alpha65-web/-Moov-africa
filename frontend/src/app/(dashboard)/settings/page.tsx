"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import api, { apiError } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import type { NotificationConfig, KpiConfig, IntegrationExport } from "@/lib/types";
import toast from "react-hot-toast";
import { useTranslations } from "next-intl";

type Tab = "general" | "notifications" | "kpi" | "security" | "integrations";

interface GeneralConfig {
  platformName: string;
  defaultLanguage: string;
  currency: string;
  timezone: string;
}

/** Politique de securite reellement appliquee par le serveur. */
interface SecurityPolicy {
  passwordMinLength: number;
  requireUppercase: boolean;
  requireLowercase: boolean;
  requireDigit: boolean;
  requireSpecialCharacter: boolean;
  checkBreachedPasswords: boolean;
  mfaMandatoryForAdmins: boolean;
}

interface PlatformSettingsResponse extends GeneralConfig {
  updatedAt: string | null;
  securityPolicy: SecurityPolicy;
}

/** Synthese par systeme cible, agregee depuis l'historique des exports. */
interface TargetSystemSummary {
  system: string;
  total: number;
  failed: number;
  lastExportAt: string | null;
  lastStatus: string | null;
}

const EMPTY_GENERAL: GeneralConfig = {
  platformName: "",
  defaultLanguage: "fr",
  currency: "XOF",
  timezone: "Africa/Ouagadougou",
};

const EXPORT_STATUS_STYLES: Record<string, string> = {
  SUCCESS: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400",
  PENDING: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
  FAILED: "bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400",
};

function Skeleton({ className }: { className: string }) {
  return <div className={`rounded-lg bg-neutral-100 dark:bg-neutral-800 animate-pulse ${className}`} />;
}

function Toggle({ enabled, onToggle }: { enabled: boolean; onToggle: () => void }) {
  return (
    <button onClick={onToggle} className={`relative w-10 h-5 rounded-full transition-colors cursor-pointer ${enabled ? "bg-primary" : "bg-neutral-300 dark:bg-neutral-600"}`}>
      <span className={`absolute top-0.5 left-0.5 size-4 rounded-full bg-white shadow transition-transform ${enabled ? "translate-x-5" : "translate-x-0"}`} />
    </button>
  );
}

export default function SettingsPage() {
  const t = useTranslations("settings");
  const tc = useTranslations("common");
  const { user } = useAuth();

  const [tab, setTab] = useState<Tab>("general");

  const [notifConfigs, setNotifConfigs] = useState<NotificationConfig[]>([]);
  const [kpiConfigs, setKpiConfigs] = useState<KpiConfig[]>([]);
  const [loadingNotif, setLoadingNotif] = useState(true);
  const [loadingKpi, setLoadingKpi] = useState(true);

  const [editingKpiId, setEditingKpiId] = useState<string | null>(null);
  const [kpiForm, setKpiForm] = useState({ label: "", thresholdExpression: "" });
  const [savingKpi, setSavingKpi] = useState(false);

  const [general, setGeneral] = useState<GeneralConfig>(EMPTY_GENERAL);
  const [generalUpdatedAt, setGeneralUpdatedAt] = useState<string | null>(null);
  const [policy, setPolicy] = useState<SecurityPolicy | null>(null);
  const [loadingGeneral, setLoadingGeneral] = useState(true);
  const [savingGeneral, setSavingGeneral] = useState(false);

  const [targets, setTargets] = useState<TargetSystemSummary[]>([]);
  const [loadingTargets, setLoadingTargets] = useState(true);

  useEffect(() => { loadNotifConfigs(); loadKpiConfigs(); loadPlatform(); loadTargets(); }, []);

  async function loadPlatform() {
    try {
      const { data } = await api.get<PlatformSettingsResponse>("/config/platform");
      setGeneral({
        platformName: data.platformName,
        defaultLanguage: data.defaultLanguage,
        currency: data.currency,
        timezone: data.timezone,
      });
      setGeneralUpdatedAt(data.updatedAt);
      setPolicy(data.securityPolicy);
    } catch (e) { toast.error(apiError(e, t("general.loadError"))); }
    finally { setLoadingGeneral(false); }
  }

  /**
   * L'onglet Integrations presente l'etat reel des systemes cibles.
   * Il n'existe pas d'endpoint d'agregation : on derive la synthese de
   * l'historique des exports, seule source de verite disponible.
   */
  async function loadTargets() {
    try {
      const { data } = await api.get("/exports", { params: { size: 500 } });
      const rows: IntegrationExport[] = Array.isArray(data) ? data : data.content ?? [];
      const bySystem = new Map<string, TargetSystemSummary>();
      for (const row of rows) {
        const current = bySystem.get(row.targetSystem) ?? {
          system: row.targetSystem, total: 0, failed: 0, lastExportAt: null, lastStatus: null,
        };
        current.total += 1;
        if (row.status === "FAILED") current.failed += 1;
        if (!current.lastExportAt || row.createdAt > current.lastExportAt) {
          current.lastExportAt = row.createdAt;
          current.lastStatus = row.status;
        }
        bySystem.set(row.targetSystem, current);
      }
      setTargets([...bySystem.values()].sort((a, b) => a.system.localeCompare(b.system)));
    } catch (e) { toast.error(apiError(e, t("integrations.loadError"))); }
    finally { setLoadingTargets(false); }
  }

  async function loadNotifConfigs() {
    try { const { data } = await api.get("/config/notifications"); setNotifConfigs(data); }
    catch (e) { toast.error(apiError(e, tc("errors.load"))); }
    finally { setLoadingNotif(false); }
  }

  async function loadKpiConfigs() {
    try { const { data } = await api.get("/config/kpi"); setKpiConfigs(data); }
    catch (e) { toast.error(apiError(e, tc("errors.load"))); }
    finally { setLoadingKpi(false); }
  }

  async function toggleNotif(config: NotificationConfig) {
    const newEnabled = !config.enabled;
    try {
      await api.put(`/config/notifications/${config.id}`, { enabled: newEnabled, channel: config.channel });
      toast.success(newEnabled ? t("notifications.notifEnabled") : t("notifications.notifDisabled"));
      loadNotifConfigs();
    } catch (e) {
      toast.error(apiError(e, tc("errors.update")));
    }
  }

  async function toggleKpi(config: KpiConfig) {
    const newEnabled = !config.enabled;
    try {
      await api.put(`/config/kpi/${config.id}`, { label: config.label, enabled: newEnabled, thresholdExpression: config.thresholdExpression || "" });
      toast.success(newEnabled ? t("kpi.kpiEnabled") : t("kpi.kpiDisabled"));
      loadKpiConfigs();
    } catch (e) {
      toast.error(apiError(e, tc("errors.update")));
    }
  }

  function openKpiEdit(config: KpiConfig) {
    setEditingKpiId(config.id);
    setKpiForm({ label: config.label, thresholdExpression: config.thresholdExpression || "" });
  }

  async function saveKpi(e: React.FormEvent) {
    e.preventDefault();
    if (savingKpi || !editingKpiId) return;
    setSavingKpi(true);
    const config = kpiConfigs.find((c) => c.id === editingKpiId);
    try {
      await api.put(`/config/kpi/${editingKpiId}`, { label: kpiForm.label, enabled: config?.enabled ?? true, thresholdExpression: kpiForm.thresholdExpression });
      toast.success(t("kpi.updated"));
      setEditingKpiId(null);
      loadKpiConfigs();
    } catch (e) {
      toast.error(apiError(e, tc("errors.update")));
    } finally { setSavingKpi(false); }
  }

  async function saveGeneral() {
    if (savingGeneral) return;
    setSavingGeneral(true);
    try {
      const { data } = await api.put<PlatformSettingsResponse>("/config/platform", general);
      setGeneralUpdatedAt(data.updatedAt);
      setPolicy(data.securityPolicy);
      toast.success(t("general.saved"));
    } catch (e) {
      toast.error(apiError(e, t("general.saveError")));
    } finally {
      setSavingGeneral(false);
    }
  }

  const activeNotifs = notifConfigs.filter((c) => c.enabled).length;
  const activeKpis = kpiConfigs.filter((c) => c.enabled).length;

  const TABS: { key: Tab; label: string; icon: React.ReactNode }[] = [
    {
      key: "general", label: t("tabs.general"),
      icon: <svg className="size-4" viewBox="0 0 20 20" fill="none"><circle cx="10" cy="10" r="3" stroke="currentColor" strokeWidth="1.5" /><path d="M10 2v2M10 16v2M2 10h2M16 10h2M4.93 4.93l1.41 1.41M13.66 13.66l1.41 1.41M4.93 15.07l1.41-1.41M13.66 6.34l1.41-1.41" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" /></svg>,
    },
    {
      key: "notifications", label: t("tabs.notifications"),
      icon: <svg className="size-4" viewBox="0 0 20 20" fill="none"><path d="M10 2a5 5 0 00-5 5v3l-1.5 2.5h13L15 10V7a5 5 0 00-5-5z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" /><path d="M8 15a2 2 0 004 0" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" /></svg>,
    },
    {
      key: "kpi", label: t("tabs.kpi"),
      icon: <svg className="size-4" viewBox="0 0 20 20" fill="none"><rect x="2" y="2" width="16" height="16" rx="2" stroke="currentColor" strokeWidth="1.5" /><path d="M6 14V10M10 14V6M14 14V8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" /></svg>,
    },
    {
      key: "security", label: t("tabs.security"),
      icon: <svg className="size-4" viewBox="0 0 20 20" fill="none"><rect x="4" y="9" width="12" height="9" rx="2" stroke="currentColor" strokeWidth="1.5" /><path d="M7 9V6a3 3 0 016 0v3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" /><circle cx="10" cy="14" r="1.5" fill="currentColor" /></svg>,
    },
    {
      key: "integrations", label: t("tabs.integrations"),
      icon: <svg className="size-4" viewBox="0 0 20 20" fill="none"><path d="M6 4v4a2 2 0 002 2h4a2 2 0 002-2V4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" /><path d="M4 4h12M8 14v4M12 14v4M6 18h8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" /><path d="M10 10v4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" /></svg>,
    },
  ];

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-primary dark:text-white flex items-center gap-3">
          <span className="size-10 rounded-xl bg-gradient-to-br from-neutral-600 to-neutral-800 dark:from-neutral-500 dark:to-neutral-700 flex items-center justify-center">
            <svg className="size-5 text-white" viewBox="0 0 20 20" fill="none"><circle cx="10" cy="10" r="3" stroke="currentColor" strokeWidth="1.5" /><path d="M10 2v2M10 16v2M2 10h2M16 10h2M4.93 4.93l1.41 1.41M13.66 13.66l1.41 1.41M4.93 15.07l1.41-1.41M13.66 6.34l1.41-1.41" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" /></svg>
          </span>
          {t("title")}
        </h1>
        <p className="text-sm text-text-secondary dark:text-neutral-400 mt-1">{t("subtitle")}</p>
      </div>

      {/* Layout: sidebar tabs + content */}
      <div className="flex flex-col lg:flex-row gap-6">
        {/* Vertical tabs */}
        <div className="lg:w-56 shrink-0">
          <nav className="flex lg:flex-col gap-1 overflow-x-auto hide-scrollbar p-1 lg:p-0 bg-neutral-100 dark:bg-neutral-800/50 lg:bg-transparent lg:dark:bg-transparent rounded-xl lg:rounded-none">
            {TABS.map((tb) => (
              <button
                key={tb.key}
                onClick={() => setTab(tb.key)}
                className={`flex items-center gap-2.5 px-4 py-2.5 rounded-xl text-sm font-medium transition-all cursor-pointer whitespace-nowrap ${
                  tab === tb.key
                    ? "bg-white dark:bg-neutral-800 text-primary dark:text-white shadow-sm lg:shadow-card"
                    : "text-text-secondary dark:text-neutral-400 hover:text-primary dark:hover:text-white hover:bg-white/50 dark:hover:bg-neutral-800/30"
                }`}
              >
                {tb.icon}
                {tb.label}
              </button>
            ))}
          </nav>
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          {/* ===== GENERAL ===== */}
          {tab === "general" && (
            <div className="space-y-6">
              <div className="bg-white dark:bg-neutral-900 rounded-2xl border border-border dark:border-neutral-800 shadow-card p-6 space-y-5">
                <h2 className="text-lg font-semibold text-primary dark:text-white">{t("general.title")}</h2>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  <div>
                    <label className="block text-sm font-medium text-text-secondary dark:text-neutral-400 mb-1.5">{t("general.platformName")}</label>
                    <input type="text" value={general.platformName} onChange={(e) => setGeneral({ ...general, platformName: e.target.value })} className="input w-full" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-text-secondary dark:text-neutral-400 mb-1.5">{t("general.defaultLanguage")}</label>
                    <select value={general.defaultLanguage} onChange={(e) => setGeneral({ ...general, defaultLanguage: e.target.value })} className="input w-full cursor-pointer">
                      <option value="fr">Français</option>
                      <option value="en">English</option>
                      <option value="ar">العربية</option>
                      <option value="sw">Kiswahili</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-text-secondary dark:text-neutral-400 mb-1.5">{t("general.currency")}</label>
                    <select value={general.currency} onChange={(e) => setGeneral({ ...general, currency: e.target.value })} className="input w-full cursor-pointer">
                      <option value="XOF">XOF — Franc CFA (BCEAO)</option>
                      <option value="XAF">XAF — Franc CFA (BEAC)</option>
                      <option value="EUR">EUR — Euro</option>
                      <option value="USD">USD — Dollar US</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-text-secondary dark:text-neutral-400 mb-1.5">{t("general.timezone")}</label>
                    <select value={general.timezone} onChange={(e) => setGeneral({ ...general, timezone: e.target.value })} className="input w-full cursor-pointer">
                      <option value="Africa/Ouagadougou">Africa/Ouagadougou (UTC+0)</option>
                      <option value="Africa/Abidjan">Africa/Abidjan (UTC+0)</option>
                      <option value="Africa/Lagos">Africa/Lagos (UTC+1)</option>
                      <option value="Africa/Douala">Africa/Douala (UTC+1)</option>
                      <option value="Europe/Paris">Europe/Paris (UTC+1)</option>
                    </select>
                  </div>
                </div>

                <div className="flex items-center justify-between pt-2">
                  <p className="text-xs text-text-secondary dark:text-neutral-500">
                    {generalUpdatedAt ? `${t("general.updatedAt")} : ${new Date(generalUpdatedAt).toLocaleString()}` : ""}
                  </p>
                  <button onClick={saveGeneral} disabled={savingGeneral || loadingGeneral} className="px-5 py-2.5 rounded-xl bg-primary hover:bg-primary/90 text-white text-sm font-semibold transition-colors disabled:opacity-50 cursor-pointer flex items-center gap-2">
                    {savingGeneral && <svg className="size-4 animate-spin" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" className="opacity-25" /><path d="M4 12a8 8 0 018-8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="opacity-75" /></svg>}
                    {savingGeneral ? t("general.saving") : t("general.save")}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* ===== NOTIFICATIONS ===== */}
          {tab === "notifications" && (
            <div className="bg-white dark:bg-neutral-900 rounded-2xl border border-border dark:border-neutral-800 shadow-card overflow-hidden">
              <div className="flex items-center justify-between px-6 py-4 border-b border-border dark:border-neutral-800">
                <div>
                  <h2 className="text-lg font-semibold text-primary dark:text-white">{t("notifications.header")}</h2>
                  <p className="text-xs text-text-secondary dark:text-neutral-400 mt-0.5">
                    {activeNotifs > 1 ? t("notifications.activeCountPlural", { count: activeNotifs }) : t("notifications.activeCount", { count: activeNotifs })}
                  </p>
                </div>
              </div>
              {loadingNotif ? (
                <div className="p-6 space-y-4">
                  {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-16" />)}
                </div>
              ) : notifConfigs.length === 0 ? (
                <div className="px-6 py-16 text-center">
                  <div className="size-14 rounded-2xl bg-neutral-100 dark:bg-neutral-800 flex items-center justify-center mx-auto mb-3">
                    <svg className="size-7 text-neutral-400" viewBox="0 0 20 20" fill="none"><path d="M10 2a5 5 0 00-5 5v3l-1.5 2.5h13L15 10V7a5 5 0 00-5-5z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" /><path d="M8 15a2 2 0 004 0" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" /></svg>
                  </div>
                  <p className="text-sm text-text-secondary dark:text-neutral-500">{t("notifications.empty")}</p>
                </div>
              ) : (
                <div className="divide-y divide-border dark:divide-neutral-800">
                  {notifConfigs.map((config) => (
                    <div key={config.id} className="flex items-center justify-between px-6 py-4 hover:bg-neutral-50 dark:hover:bg-neutral-800/30 transition-colors">
                      <div className="min-w-0 flex-1 mr-4">
                        <p className="text-sm font-semibold text-primary dark:text-white">{t(`notifications.types.${config.type}`)}</p>
                        <div className="flex items-center gap-2 mt-1">
                          <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-medium bg-neutral-100 dark:bg-neutral-800 text-text-secondary dark:text-neutral-400">
                            {t(`notifications.channels.${config.channel}`)}
                          </span>
                        </div>
                      </div>
                      <Toggle enabled={config.enabled} onToggle={() => toggleNotif(config)} />
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ===== KPI ===== */}
          {tab === "kpi" && (
            <div className="bg-white dark:bg-neutral-900 rounded-2xl border border-border dark:border-neutral-800 shadow-card overflow-hidden">
              <div className="flex items-center justify-between px-6 py-4 border-b border-border dark:border-neutral-800">
                <div>
                  <h2 className="text-lg font-semibold text-primary dark:text-white">{t("kpi.header")}</h2>
                  <p className="text-xs text-text-secondary dark:text-neutral-400 mt-0.5">
                    {activeKpis > 1 ? t("kpi.activeCountPlural", { count: activeKpis }) : t("kpi.activeCount", { count: activeKpis })}
                  </p>
                </div>
              </div>
              {loadingKpi ? (
                <div className="p-6 space-y-4">
                  {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-16" />)}
                </div>
              ) : kpiConfigs.length === 0 ? (
                <div className="px-6 py-16 text-center">
                  <div className="size-14 rounded-2xl bg-neutral-100 dark:bg-neutral-800 flex items-center justify-center mx-auto mb-3">
                    <svg className="size-7 text-neutral-400" viewBox="0 0 20 20" fill="none"><rect x="2" y="2" width="16" height="16" rx="2" stroke="currentColor" strokeWidth="1.5" /><path d="M6 14V10M10 14V6M14 14V8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" /></svg>
                  </div>
                  <p className="text-sm text-text-secondary dark:text-neutral-500">{t("kpi.empty")}</p>
                </div>
              ) : (
                <div className="divide-y divide-border dark:divide-neutral-800">
                  {kpiConfigs.map((config) => (
                    <div key={config.id} className="px-6 py-4 hover:bg-neutral-50 dark:hover:bg-neutral-800/30 transition-colors">
                      {editingKpiId === config.id ? (
                        <form onSubmit={saveKpi} className="flex flex-col gap-3">
                          <div className="flex items-center gap-2">
                            <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-medium bg-neutral-100 dark:bg-neutral-800 text-text-secondary dark:text-neutral-400">{config.kpiCode}</span>
                          </div>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            <div>
                              <label className="block text-xs font-medium text-text-secondary dark:text-neutral-500 mb-1">{t("kpi.label")}</label>
                              <input type="text" value={kpiForm.label} onChange={(e) => setKpiForm({ ...kpiForm, label: e.target.value })} className="input w-full" required />
                            </div>
                            <div>
                              <label className="block text-xs font-medium text-text-secondary dark:text-neutral-500 mb-1">{t("kpi.threshold")}</label>
                              <input type="text" value={kpiForm.thresholdExpression} onChange={(e) => setKpiForm({ ...kpiForm, thresholdExpression: e.target.value })} className="input w-full" placeholder={t("kpi.thresholdPlaceholder")} />
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <button type="submit" disabled={savingKpi} className="px-4 py-2 rounded-xl bg-primary hover:bg-primary/90 text-white text-sm font-medium transition-colors disabled:opacity-50 cursor-pointer">
                              {savingKpi ? t("kpi.saving") : t("kpi.save")}
                            </button>
                            <button type="button" onClick={() => setEditingKpiId(null)} className="px-4 py-2 rounded-xl border border-border dark:border-neutral-700 text-sm font-medium text-text-secondary dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors cursor-pointer">
                              {t("kpi.cancel")}
                            </button>
                          </div>
                        </form>
                      ) : (
                        <div className="flex items-center justify-between">
                          <div className="min-w-0 flex-1 mr-4">
                            <div className="flex items-center gap-2">
                              <p className="text-sm font-semibold text-primary dark:text-white">{config.label}</p>
                              <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-medium bg-neutral-100 dark:bg-neutral-800 text-text-secondary dark:text-neutral-400">{config.kpiCode}</span>
                            </div>
                            {config.thresholdExpression && (
                              <p className="text-xs text-text-secondary dark:text-neutral-500 mt-0.5">{t("kpi.thresholdPrefix")} {config.thresholdExpression}</p>
                            )}
                          </div>
                          <div className="flex items-center gap-3">
                            <button onClick={() => openKpiEdit(config)} className="p-1.5 rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors cursor-pointer" title={t("kpi.edit")}>
                              <svg className="size-4 text-text-secondary dark:text-neutral-400" viewBox="0 0 16 16" fill="none"><path d="M11.5 1.5l3 3L5 14H2v-3l9.5-9.5z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" /></svg>
                            </button>
                            <Toggle enabled={config.enabled} onToggle={() => toggleKpi(config)} />
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ===== SECURITE ===== */}
          {tab === "security" && (
            <div className="space-y-6">
              {/* Politique reellement appliquee par le serveur, en lecture seule */}
              <div className="bg-white dark:bg-neutral-900 rounded-2xl border border-border dark:border-neutral-800 shadow-card p-6 space-y-4">
                <div>
                  <h2 className="text-lg font-semibold text-primary dark:text-white">{t("security.serverPolicy")}</h2>
                  <p className="text-xs text-text-secondary dark:text-neutral-400 mt-0.5">{t("security.serverPolicyDesc")}</p>
                </div>

                {!policy ? (
                  <div className="space-y-3">{[...Array(5)].map((_, i) => <Skeleton key={i} className="h-10" />)}</div>
                ) : (
                  <ul className="divide-y divide-border dark:divide-neutral-800">
                    {[
                      { label: t("security.minLengthValue", { n: policy.passwordMinLength }), on: true },
                      { label: t("security.requireUppercase"), on: policy.requireUppercase },
                      { label: t("security.requireLowercase"), on: policy.requireLowercase },
                      { label: t("security.requireDigit"), on: policy.requireDigit },
                      { label: t("security.requireSpecial"), on: policy.requireSpecialCharacter },
                      { label: t("security.checkBreached"), on: policy.checkBreachedPasswords },
                      { label: t("security.mfaMandatory"), on: policy.mfaMandatoryForAdmins },
                    ].map((rule) => (
                      <li key={rule.label} className="flex items-center justify-between py-3">
                        <span className="text-sm text-text-secondary dark:text-neutral-400">{rule.label}</span>
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold ${
                          rule.on
                            ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400"
                            : "bg-neutral-100 text-neutral-600 dark:bg-neutral-800 dark:text-neutral-400"
                        }`}>
                          {rule.on ? t("security.enforced") : t("security.notEnforced")}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              {/* Etat reel de la double authentification du compte connecte */}
              <div className="bg-white dark:bg-neutral-900 rounded-2xl border border-border dark:border-neutral-800 shadow-card p-6">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <h2 className="text-lg font-semibold text-primary dark:text-white">{t("security.myMfa")}</h2>
                      <span className={`px-2 py-0.5 rounded-full text-[11px] font-semibold ${
                        user?.totpEnabled
                          ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400"
                          : "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400"
                      }`}>
                        {user?.totpEnabled ? t("security.mfaOn") : t("security.mfaOff")}
                      </span>
                    </div>
                    <p className="text-xs text-text-secondary dark:text-neutral-400 mt-1">{t("security.myMfaDesc")}</p>
                  </div>
                  <Link
                    href="/profile"
                    className="shrink-0 px-4 py-2 rounded-xl bg-primary hover:bg-primary/90 text-white text-sm font-medium transition-colors text-center"
                  >
                    {t("security.manageInProfile")}
                  </Link>
                </div>
              </div>
            </div>
          )}

          {/* ===== INTEGRATIONS ===== */}
          {tab === "integrations" && (
            <div className="bg-white dark:bg-neutral-900 rounded-2xl border border-border dark:border-neutral-800 shadow-card overflow-hidden">
              <div className="px-6 py-4 border-b border-border dark:border-neutral-800">
                <h2 className="text-lg font-semibold text-primary dark:text-white">{t("integrations.header")}</h2>
                <p className="text-xs text-text-secondary dark:text-neutral-400 mt-0.5">{t("integrations.headerDesc")}</p>
              </div>

              {loadingTargets ? (
                <div className="p-6 space-y-4">{[...Array(3)].map((_, i) => <Skeleton key={i} className="h-16" />)}</div>
              ) : targets.length === 0 ? (
                <div className="px-6 py-16 text-center">
                  <div className="size-14 rounded-2xl bg-neutral-100 dark:bg-neutral-800 flex items-center justify-center mx-auto mb-3">
                    <svg className="size-7 text-neutral-400" viewBox="0 0 20 20" fill="none"><path d="M4 13v3a2 2 0 002 2h8a2 2 0 002-2v-3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" /><path d="M10 3v10M7 6l3-3 3 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
                  </div>
                  <p className="text-sm text-text-secondary dark:text-neutral-500">{t("integrations.noData")}</p>
                </div>
              ) : (
                <div className="divide-y divide-border dark:divide-neutral-800">
                  {targets.map((target) => (
                    <div key={target.system} className="flex items-center justify-between px-6 py-4 hover:bg-neutral-50 dark:hover:bg-neutral-800/30 transition-colors">
                      <div className="flex items-center gap-4 min-w-0">
                        <div className="size-10 rounded-xl bg-neutral-100 dark:bg-neutral-800 flex items-center justify-center shrink-0">
                          <svg className="size-5 text-text-secondary dark:text-neutral-400" viewBox="0 0 20 20" fill="none">
                            <path d="M4 10h12M4 6h12M4 14h8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                            <circle cx="16" cy="14" r="2" stroke="currentColor" strokeWidth="1.5" />
                          </svg>
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="text-sm font-semibold text-primary dark:text-white">{target.system}</p>
                            {target.lastStatus && (
                              <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase ${
                                EXPORT_STATUS_STYLES[target.lastStatus] ?? EXPORT_STATUS_STYLES.PENDING
                              }`}>
                                {target.lastStatus}
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-text-secondary dark:text-neutral-400 mt-0.5">
                            {target.lastExportAt
                              ? `${t("integrations.lastExport")} ${new Date(target.lastExportAt).toLocaleString()}`
                              : t("integrations.never")}
                          </p>
                        </div>
                      </div>
                      <div className="text-right shrink-0 ml-4">
                        <p className="text-sm font-semibold text-primary dark:text-white">
                          {target.total} <span className="text-xs font-normal text-text-secondary dark:text-neutral-400">{t("integrations.total")}</span>
                        </p>
                        {target.failed > 0 && (
                          <p className="text-xs text-red-600 dark:text-red-400">{target.failed} {t("integrations.failed")}</p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
