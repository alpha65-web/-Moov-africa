"use client";

import { useEffect, useState } from "react";
import api from "@/lib/api";
import type { NotificationConfig, KpiConfig } from "@/lib/types";
import toast from "react-hot-toast";
import { useThemeColor, THEME_PRESETS } from "@/lib/theme";

export default function SettingsPage() {
  const [tab, setTab] = useState<"appearance" | "notifications" | "kpi">("appearance");
  const { themeKey, setThemeKey } = useThemeColor();

  const [notifConfigs, setNotifConfigs] = useState<NotificationConfig[]>([]);
  const [kpiConfigs, setKpiConfigs] = useState<KpiConfig[]>([]);
  const [loadingNotif, setLoadingNotif] = useState(true);
  const [loadingKpi, setLoadingKpi] = useState(true);

  const [editingKpiId, setEditingKpiId] = useState<string | null>(null);
  const [kpiForm, setKpiForm] = useState({ label: "", thresholdExpression: "" });
  const [savingKpi, setSavingKpi] = useState(false);

  useEffect(() => {
    loadNotifConfigs();
    loadKpiConfigs();
  }, []);

  async function loadNotifConfigs() {
    try {
      const { data } = await api.get("/config/notifications");
      setNotifConfigs(data);
    } catch {
      /* API pas disponible */
    } finally {
      setLoadingNotif(false);
    }
  }

  async function loadKpiConfigs() {
    try {
      const { data } = await api.get("/config/kpi");
      setKpiConfigs(data);
    } catch {
      /* API pas disponible */
    } finally {
      setLoadingKpi(false);
    }
  }

  async function toggleNotif(config: NotificationConfig) {
    const newEnabled = !config.enabled;
    try {
      await api.put(`/config/notifications/${config.id}`, {
        enabled: newEnabled,
        channel: config.channel,
      });
      toast.success(newEnabled ? "Notification activée" : "Notification désactivée");
      loadNotifConfigs();
    } catch {
      setNotifConfigs((prev) =>
        prev.map((c) => (c.id === config.id ? { ...c, enabled: newEnabled } : c))
      );
      toast.success(newEnabled ? "Notification activée" : "Notification désactivée");
    }
  }

  async function toggleKpi(config: KpiConfig) {
    const newEnabled = !config.enabled;
    try {
      await api.put(`/config/kpi/${config.id}`, {
        label: config.label,
        enabled: newEnabled,
        thresholdExpression: config.thresholdExpression || "",
      });
      toast.success(newEnabled ? "KPI activé" : "KPI désactivé");
      loadKpiConfigs();
    } catch {
      setKpiConfigs((prev) =>
        prev.map((c) => (c.id === config.id ? { ...c, enabled: newEnabled } : c))
      );
      toast.success(newEnabled ? "KPI activé" : "KPI désactivé");
    }
  }

  function openKpiEdit(config: KpiConfig) {
    setEditingKpiId(config.id);
    setKpiForm({
      label: config.label,
      thresholdExpression: config.thresholdExpression || "",
    });
  }

  async function saveKpi(e: React.FormEvent) {
    e.preventDefault();
    if (savingKpi || !editingKpiId) return;
    setSavingKpi(true);
    const config = kpiConfigs.find((c) => c.id === editingKpiId);
    try {
      await api.put(`/config/kpi/${editingKpiId}`, {
        label: kpiForm.label,
        enabled: config?.enabled ?? true,
        thresholdExpression: kpiForm.thresholdExpression,
      });
      toast.success("KPI mis à jour");
      setEditingKpiId(null);
      loadKpiConfigs();
    } catch {
      setKpiConfigs((prev) =>
        prev.map((c) =>
          c.id === editingKpiId
            ? { ...c, label: kpiForm.label, thresholdExpression: kpiForm.thresholdExpression }
            : c
        )
      );
      toast.success("KPI mis à jour");
      setEditingKpiId(null);
    } finally {
      setSavingKpi(false);
    }
  }

  const TABS = [
    { key: "appearance" as const, label: "Apparence", count: THEME_PRESETS.length },
    { key: "notifications" as const, label: "Notifications", count: notifConfigs.length },
    { key: "kpi" as const, label: "Indicateurs KPI", count: kpiConfigs.length },
  ];

  const NOTIF_TYPE_LABELS: Record<string, string> = {
    OFFER_CREATED: "Offre créée",
    OFFER_TRANSITION: "Transition d'offre",
    OFFER_PUBLISHED: "Offre publiée",
    MEDIA_UPLOADED: "Média uploadé",
    MEDIA_VALIDATED: "Média validé",
    CAMPAIGN_SCHEDULED: "Campagne planifiée",
    USER_REGISTERED: "Utilisateur inscrit",
  };

  const CHANNEL_LABELS: Record<string, string> = {
    IN_APP: "Application",
    EMAIL: "Email",
    SMS: "SMS",
    PUSH: "Push",
  };

  return (
    <div className="flex flex-col gap-6">
      {/* Tabs */}
      <div className="flex gap-1 p-1 rounded-xl bg-neutral-100 dark:bg-neutral-800/50 border border-border dark:border-neutral-800 w-fit">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`px-4 py-2 text-sm font-medium transition-all cursor-pointer ${
              tab === t.key
                ? "bg-white dark:bg-neutral-700 text-black dark:text-white shadow-sm"
                : "text-text-secondary dark:text-neutral-400 hover:text-black dark:hover:text-white"
            }`}
            style={{ borderRadius: 8 }}
          >
            {t.label}
            <span
              className={`ml-1.5 text-[11px] ${
                tab === t.key ? "text-primary" : "text-neutral-400"
              }`}
            >
              {t.count}
            </span>
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="rounded-2xl border border-border dark:border-neutral-800 bg-white dark:bg-neutral-900 shadow-card overflow-hidden">
        {tab === "appearance" && (
          <div>
            <div className="flex items-center justify-between px-6 py-3 border-b border-primary bg-primary dark:bg-primary rounded-t-2xl">
              <h2 className="text-sm font-semibold text-white uppercase tracking-wider">
                Thème de couleur
              </h2>
              <span className="text-xs text-white/70">
                {THEME_PRESETS.find(p => p.key === themeKey)?.label}
              </span>
            </div>

            <div className="p-6">
              <p className="text-sm text-text-secondary dark:text-neutral-400 mb-5">
                Choisissez la couleur principale de votre interface. Elle sera appliquée sur tous les boutons, liens et accents.
              </p>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {THEME_PRESETS.map(preset => {
                  const active = themeKey === preset.key;
                  return (
                    <button
                      key={preset.key}
                      onClick={() => setThemeKey(preset.key)}
                      className={`relative flex items-center gap-3 p-4 rounded-xl border-2 transition-all cursor-pointer ${
                        active
                          ? "border-current ring-2 ring-offset-2 ring-offset-white dark:ring-offset-neutral-900"
                          : "border-neutral-200 dark:border-neutral-700 hover:border-neutral-300 dark:hover:border-neutral-600"
                      }`}
                      style={active ? { borderColor: preset.primary, outlineColor: preset.primary } : {}}
                    >
                      <span
                        className="size-8 rounded-lg shrink-0 shadow-sm"
                        style={{ background: `linear-gradient(135deg, ${preset.primaryLight}, ${preset.primary})` }}
                      />
                      <div className="text-left min-w-0">
                        <p className="text-sm font-medium text-black dark:text-white">{preset.label}</p>
                        <p className="text-[11px] text-text-secondary dark:text-neutral-500 font-mono">{preset.primary}</p>
                      </div>
                      {active && (
                        <span className="absolute top-2 right-2">
                          <svg className="size-4" viewBox="0 0 20 20" fill="none" style={{ color: preset.primary }}>
                            <circle cx="10" cy="10" r="8" fill="currentColor" />
                            <path d="M7 10l2 2 4-4" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                          </svg>
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>

              {/* Preview */}
              <div className="mt-8">
                <p className="text-xs font-semibold text-text-secondary dark:text-neutral-500 uppercase tracking-wider mb-3">Aperçu</p>
                <div className="flex flex-wrap items-center gap-3 p-5 rounded-xl bg-neutral-50 dark:bg-neutral-800/50 border border-border dark:border-neutral-800">
                  <button
                    className="px-4 py-2 rounded-lg text-sm font-medium text-white transition-colors"
                    style={{ background: THEME_PRESETS.find(p => p.key === themeKey)?.primary }}
                  >
                    Bouton principal
                  </button>
                  <button
                    className="px-4 py-2 rounded-lg text-sm font-medium border transition-colors"
                    style={{ borderColor: THEME_PRESETS.find(p => p.key === themeKey)?.primary, color: THEME_PRESETS.find(p => p.key === themeKey)?.primary }}
                  >
                    Bouton secondaire
                  </button>
                  <span
                    className="text-sm font-medium underline underline-offset-2 cursor-pointer"
                    style={{ color: THEME_PRESETS.find(p => p.key === themeKey)?.primary }}
                  >
                    Lien d&apos;exemple
                  </span>
                  <span
                    className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium text-white"
                    style={{ background: THEME_PRESETS.find(p => p.key === themeKey)?.primary }}
                  >
                    Badge
                  </span>
                  <span
                    className="inline-flex items-center gap-1.5 text-sm"
                  >
                    <span className="size-2 rounded-full" style={{ background: THEME_PRESETS.find(p => p.key === themeKey)?.primary }} />
                    <span className="text-neutral-600 dark:text-neutral-400">Indicateur actif</span>
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}

        {tab === "notifications" && (
          <>
            <div className="flex items-center justify-between px-6 py-3 border-b border-blue-600 bg-blue-600 dark:bg-blue-700 rounded-t-2xl">
              <h2 className="text-sm font-semibold text-white uppercase tracking-wider">
                Configuration des notifications
              </h2>
              <span className="text-xs text-white/70">
                {notifConfigs.filter((c) => c.enabled).length} active
                {notifConfigs.filter((c) => c.enabled).length > 1 ? "s" : ""}
              </span>
            </div>
            {loadingNotif ? (
              <div className="px-6 py-4 flex flex-col gap-3">
                {[...Array(4)].map((_, i) => (
                  <div key={i} className="flex items-center justify-between py-3">
                    <div className="flex flex-col gap-1.5">
                      <div className="w-40 h-4 rounded bg-neutral-100 dark:bg-neutral-800 animate-pulse" />
                      <div className="w-24 h-3 rounded bg-neutral-100 dark:bg-neutral-800 animate-pulse" />
                    </div>
                    <div className="w-10 h-5 rounded-full bg-neutral-100 dark:bg-neutral-800 animate-pulse" />
                  </div>
                ))}
              </div>
            ) : notifConfigs.length === 0 ? (
              <div className="px-6 py-12 text-center">
                <div className="flex flex-col items-center gap-3">
                  <div className="size-12 rounded-xl bg-neutral-100 dark:bg-neutral-800 flex items-center justify-center">
                    <svg className="size-6 text-neutral-400" viewBox="0 0 16 16" fill="none">
                      <path
                        d="M8 1.5c-2.5 0-4.5 2-4.5 4.5v3l-1 2h11l-1-2v-3c0-2.5-2-4.5-4.5-4.5z"
                        stroke="currentColor"
                        strokeWidth="1.2"
                        strokeLinejoin="round"
                      />
                      <path d="M6 12a2 2 0 004 0" stroke="currentColor" strokeWidth="1.2" />
                    </svg>
                  </div>
                  <p className="text-sm text-text-secondary dark:text-neutral-500">
                    Aucune configuration de notification
                  </p>
                </div>
              </div>
            ) : (
              <div className="divide-y divide-border dark:divide-neutral-800">
                {notifConfigs.map((config) => (
                  <div
                    key={config.id}
                    className="flex items-center justify-between px-6 py-4 hover:bg-neutral-50 dark:hover:bg-neutral-800/30 transition-colors"
                  >
                    <div className="min-w-0 flex-1 mr-4">
                      <p className="text-sm font-bold text-black dark:text-white">
                        {NOTIF_TYPE_LABELS[config.type] || config.type}
                      </p>
                      <div className="flex items-center gap-2 mt-1">
                        <span
                          className="inline-flex items-center px-2 py-0.5 text-[11px] font-medium bg-black text-white dark:bg-white dark:text-black"
                          style={{ borderRadius: 4 }}
                        >
                          {CHANNEL_LABELS[config.channel] || config.channel}
                        </span>
                      </div>
                    </div>
                    <button
                      onClick={() => toggleNotif(config)}
                      className={`relative w-10 h-5 rounded-full transition-colors cursor-pointer ${
                        config.enabled
                          ? "bg-primary"
                          : "bg-neutral-300 dark:bg-neutral-600"
                      }`}
                    >
                      <span
                        className={`absolute top-0.5 left-0.5 size-4 rounded-full bg-white shadow transition-transform ${
                          config.enabled ? "translate-x-5" : "translate-x-0"
                        }`}
                      />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {tab === "kpi" && (
          <>
            <div className="flex items-center justify-between px-6 py-3 border-b border-blue-600 bg-blue-600 dark:bg-blue-700 rounded-t-2xl">
              <h2 className="text-sm font-semibold text-white uppercase tracking-wider">
                Indicateurs KPI
              </h2>
              <span className="text-xs text-white/70">
                {kpiConfigs.filter((c) => c.enabled).length} actif
                {kpiConfigs.filter((c) => c.enabled).length > 1 ? "s" : ""}
              </span>
            </div>
            {loadingKpi ? (
              <div className="px-6 py-4 flex flex-col gap-3">
                {[...Array(4)].map((_, i) => (
                  <div key={i} className="flex items-center justify-between py-3">
                    <div className="flex flex-col gap-1.5">
                      <div className="w-40 h-4 rounded bg-neutral-100 dark:bg-neutral-800 animate-pulse" />
                      <div className="w-24 h-3 rounded bg-neutral-100 dark:bg-neutral-800 animate-pulse" />
                    </div>
                    <div className="w-10 h-5 rounded-full bg-neutral-100 dark:bg-neutral-800 animate-pulse" />
                  </div>
                ))}
              </div>
            ) : kpiConfigs.length === 0 ? (
              <div className="px-6 py-12 text-center">
                <div className="flex flex-col items-center gap-3">
                  <div className="size-12 rounded-xl bg-neutral-100 dark:bg-neutral-800 flex items-center justify-center">
                    <svg className="size-6 text-neutral-400" viewBox="0 0 16 16" fill="none">
                      <rect
                        x="2"
                        y="2"
                        width="12"
                        height="12"
                        rx="2"
                        stroke="currentColor"
                        strokeWidth="1.2"
                      />
                      <path
                        d="M5 10V8M8 10V6M11 10V4"
                        stroke="currentColor"
                        strokeWidth="1.5"
                        strokeLinecap="round"
                      />
                    </svg>
                  </div>
                  <p className="text-sm text-text-secondary dark:text-neutral-500">
                    Aucun indicateur configuré
                  </p>
                </div>
              </div>
            ) : (
              <div className="divide-y divide-border dark:divide-neutral-800">
                {kpiConfigs.map((config) => (
                  <div
                    key={config.id}
                    className="px-6 py-4 hover:bg-neutral-50 dark:hover:bg-neutral-800/30 transition-colors"
                  >
                    {editingKpiId === config.id ? (
                      <form onSubmit={saveKpi} className="flex flex-col gap-3">
                        <div className="flex items-center gap-3">
                          <span
                            className="inline-flex items-center px-2 py-0.5 text-[11px] font-medium bg-black text-white dark:bg-white dark:text-black"
                            style={{ borderRadius: 4 }}
                          >
                            {config.kpiCode}
                          </span>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                          <div>
                            <label className="block text-xs font-semibold text-text-secondary dark:text-neutral-500 uppercase tracking-wider mb-1">
                              Libellé
                            </label>
                            <input
                              type="text"
                              value={kpiForm.label}
                              onChange={(e) =>
                                setKpiForm({ ...kpiForm, label: e.target.value })
                              }
                              className="input w-full"
                              required
                            />
                          </div>
                          <div>
                            <label className="block text-xs font-semibold text-text-secondary dark:text-neutral-500 uppercase tracking-wider mb-1">
                              Seuil
                            </label>
                            <input
                              type="text"
                              value={kpiForm.thresholdExpression}
                              onChange={(e) =>
                                setKpiForm({
                                  ...kpiForm,
                                  thresholdExpression: e.target.value,
                                })
                              }
                              className="input w-full"
                              placeholder="Ex: > 80"
                            />
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            type="submit"
                            disabled={savingKpi}
                            className="primary-icon px-4 py-2 active-scale"
                          >
                            <p className="text-sm font-medium">
                              {savingKpi ? "Enregistrement..." : "Enregistrer"}
                            </p>
                          </button>
                          <button
                            type="button"
                            onClick={() => setEditingKpiId(null)}
                            className="tertiary-icon px-3 py-2 active-scale"
                          >
                            <p className="text-sm font-medium">Annuler</p>
                          </button>
                        </div>
                      </form>
                    ) : (
                      <div className="flex items-center justify-between">
                        <div className="min-w-0 flex-1 mr-4">
                          <div className="flex items-center gap-2">
                            <p className="text-sm font-bold text-black dark:text-white">
                              {config.label}
                            </p>
                            <span
                              className="inline-flex items-center px-2 py-0.5 text-[11px] font-medium bg-black text-white dark:bg-white dark:text-black"
                              style={{ borderRadius: 4 }}
                            >
                              {config.kpiCode}
                            </span>
                          </div>
                          {config.thresholdExpression && (
                            <p className="text-xs text-text-secondary dark:text-neutral-500 mt-0.5">
                              Seuil: {config.thresholdExpression}
                            </p>
                          )}
                        </div>
                        <div className="flex items-center gap-3">
                          <button
                            onClick={() => openKpiEdit(config)}
                            className="p-1.5 rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
                            title="Modifier"
                          >
                            <svg
                              className="size-4 text-black dark:text-white"
                              viewBox="0 0 16 16"
                              fill="none"
                            >
                              <path
                                d="M11.5 1.5l3 3L5 14H2v-3l9.5-9.5z"
                                stroke="currentColor"
                                strokeWidth="1.3"
                                strokeLinejoin="round"
                              />
                            </svg>
                          </button>
                          <button
                            onClick={() => toggleKpi(config)}
                            className={`relative w-10 h-5 rounded-full transition-colors cursor-pointer ${
                              config.enabled
                                ? "bg-primary"
                                : "bg-neutral-300 dark:bg-neutral-600"
                            }`}
                          >
                            <span
                              className={`absolute top-0.5 left-0.5 size-4 rounded-full bg-white shadow transition-transform ${
                                config.enabled
                                  ? "translate-x-5"
                                  : "translate-x-0"
                              }`}
                            />
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
