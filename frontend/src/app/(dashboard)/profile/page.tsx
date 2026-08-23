"use client";

import { useState } from "react";
import { useAuth } from "@/lib/auth";
import api, { apiError } from "@/lib/api";
import toast from "react-hot-toast";
import { useTranslations } from "next-intl";
import type { LoginResponse } from "@/lib/types";

type ProfileTab = "info" | "password" | "mfa";

export default function ProfilePage() {
  const { user, applySession, refreshUser } = useAuth();
  const t = useTranslations("profile");
  const tr = useTranslations("users.roles");

  const [tab, setTab] = useState<ProfileTab | null>(null);
  // Derive plutot que stocke : un changement impose ouvre directement
  // l'onglet mot de passe, sans setState dans un effet.
  const activeTab: ProfileTab = tab ?? (user?.forcePasswordChange ? "password" : "info");

  const [pwForm, setPwForm] = useState({ currentPassword: "", newPassword: "", confirmPassword: "" });
  const [changingPw, setChangingPw] = useState(false);
  const [showCurrentPw, setShowCurrentPw] = useState(false);
  const [showNewPw, setShowNewPw] = useState(false);

  // Le backend renvoie { secret, otpAuthUri } : le champ etait lu sous le nom "uri",
  // donc l'URI d'enrolement etait systematiquement undefined.
  const [mfaSetup, setMfaSetup] = useState<{ secret: string; otpAuthUri: string } | null>(null);
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [secretCopied, setSecretCopied] = useState(false);
  const [mfaCode, setMfaCode] = useState("");
  const [enablingMfa, setEnablingMfa] = useState(false);
  const [disablingMfa, setDisablingMfa] = useState(false);
  const [disableCode, setDisableCode] = useState("");

  async function handleChangePassword(e: React.FormEvent) {
    e.preventDefault();
    if (changingPw) return;
    if (pwForm.newPassword !== pwForm.confirmPassword) { toast.error(t("password.mismatch")); return; }
    if (pwForm.newPassword.length < 12) { toast.error(t("password.tooShort")); return; }
    setChangingPw(true);
    try {
      const { data } = await api.post<LoginResponse>("/auth/change-password", { currentPassword: pwForm.currentPassword, newPassword: pwForm.newPassword });
      // Le backend incremente tokenVersion et revoque les refresh tokens.
      // Sans reprise des jetons renvoyes, la session en cours devient invalide.
      applySession(data);
      toast.success(t("password.success"));
      setPwForm({ currentPassword: "", newPassword: "", confirmPassword: "" });
    } catch (e) { toast.error(apiError(e, t("password.error"))); }
    finally { setChangingPw(false); }
  }

  async function handleSetupMfa() {
    try {
      const { data } = await api.post<{ secret: string; otpAuthUri: string }>("/auth/totp/setup");
      setMfaSetup(data);
      // Le QR est genere localement : aucune donnee du secret ne sort du navigateur.
      const QRCode = (await import("qrcode")).default;
      setQrDataUrl(await QRCode.toDataURL(data.otpAuthUri, { width: 220, margin: 1 }));
    } catch (e) {
      toast.error(apiError(e, t("mfa.setupError")));
    }
  }

  function copySecret() {
    if (!mfaSetup) return;
    navigator.clipboard.writeText(mfaSetup.secret);
    setSecretCopied(true);
    setTimeout(() => setSecretCopied(false), 2000);
  }

  async function handleEnableMfa(e: React.FormEvent) {
    e.preventDefault();
    if (enablingMfa || !mfaCode) return;
    setEnablingMfa(true);
    try {
      await api.post("/auth/totp/enable", { code: mfaCode });
      toast.success(t("mfa.enableSuccess"));
      setMfaSetup(null); setMfaCode(""); setQrDataUrl(null);
      // Sans cette resynchronisation, l'ecran continue d'afficher le formulaire
      // d'enrolement alors que la 2FA est deja active cote serveur.
      await refreshUser();
    } catch (e) {
      toast.error(apiError(e, t("mfa.invalidCode")));
    } finally { setEnablingMfa(false); }
  }

  async function handleDisableMfa(e: React.FormEvent) {
    e.preventDefault();
    if (disablingMfa || !disableCode) return;
    setDisablingMfa(true);
    try {
      await api.delete("/auth/totp", { data: { code: disableCode } });
      toast.success(t("mfa.disableSuccess"));
      setDisableCode("");
      await refreshUser();
    } catch (e) {
      toast.error(apiError(e, t("mfa.invalidCode")));
    } finally { setDisablingMfa(false); }
  }

  if (!user) return null;

  const TABS = [
    { key: "info" as const, label: t("tabs.info") },
    { key: "password" as const, label: t("tabs.password") },
    { key: "mfa" as const, label: t("tabs.mfa") },
  ];

  return (
    <div className="flex flex-col gap-6 pb-8">
      {/* Header */}
      <div className="flex items-center gap-4">
        <div className="flex items-center justify-center size-16 rounded-2xl bg-primary text-white text-2xl font-bold">
          {user.firstName?.[0]}{user.lastName?.[0]}
        </div>
        <div>
          <h1 className="text-2xl font-bold text-black dark:text-white">{user.firstName} {user.lastName}</h1>
          <p className="text-sm text-text-secondary dark:text-neutral-500 mt-0.5">{tr.has(user.role) ? tr(user.role) : user.role}</p>
        </div>
      </div>

      {user.forcePasswordChange && (
        <div className="flex items-start gap-3 rounded-xl border border-amber-300 bg-amber-50 p-4 dark:border-amber-900/50 dark:bg-amber-900/20">
          <svg className="size-5 shrink-0 text-amber-600 dark:text-amber-400 mt-px" viewBox="0 0 20 20" fill="none" aria-hidden="true">
            <path d="M10 7v4m0 3h.01M8.6 2.9 1.7 15.1a1.6 1.6 0 0 0 1.4 2.4h13.8a1.6 1.6 0 0 0 1.4-2.4L11.4 2.9a1.6 1.6 0 0 0-2.8 0Z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <p className="text-sm text-amber-900 dark:text-amber-200">{t("password.forced")}</p>
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 p-1 rounded-xl bg-neutral-100 dark:bg-neutral-800/50 border border-border dark:border-neutral-800 w-fit">
        {TABS.map((tb) => (
          <button key={tb.key} onClick={() => setTab(tb.key)} className={`px-4 py-2 text-sm font-medium transition-all cursor-pointer ${activeTab === tb.key ? "bg-white dark:bg-neutral-700 text-black dark:text-white shadow-sm" : "text-text-secondary dark:text-neutral-400 hover:text-black dark:hover:text-white"}`} style={{ borderRadius: 8 }}>
            {tb.label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="rounded-2xl border border-border dark:border-neutral-800 bg-white dark:bg-neutral-900 shadow-card overflow-hidden">
        {activeTab === "info" && (
          <div className="p-6">
            <h2 className="text-lg font-bold text-black dark:text-white mb-6">{t("info.title")}</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-xs font-semibold text-text-secondary dark:text-neutral-500 uppercase tracking-wider mb-1.5">{t("info.firstName")}</label>
                <p className="text-sm font-bold text-black dark:text-white">{user.firstName}</p>
              </div>
              <div>
                <label className="block text-xs font-semibold text-text-secondary dark:text-neutral-500 uppercase tracking-wider mb-1.5">{t("info.lastName")}</label>
                <p className="text-sm font-bold text-black dark:text-white">{user.lastName}</p>
              </div>
              <div>
                <label className="block text-xs font-semibold text-text-secondary dark:text-neutral-500 uppercase tracking-wider mb-1.5">{t("info.email")}</label>
                <p className="text-sm font-bold text-black dark:text-white">{user.email}</p>
              </div>
              <div>
                <label className="block text-xs font-semibold text-text-secondary dark:text-neutral-500 uppercase tracking-wider mb-1.5">{t("info.role")}</label>
                <span className="inline-flex items-center px-2 py-0.5 text-[11px] font-medium bg-black text-white dark:bg-white dark:text-black" style={{ borderRadius: 4 }}>
                  {tr.has(user.role) ? tr(user.role) : user.role}
                </span>
              </div>
              <div>
                <label className="block text-xs font-semibold text-text-secondary dark:text-neutral-500 uppercase tracking-wider mb-1.5">{t("info.status")}</label>
                <span className="inline-flex items-center px-2 py-0.5 text-[11px] font-medium bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400" style={{ borderRadius: 4 }}>
                  {user.status === "ACTIVE" ? t("info.statusActive") : user.status}
                </span>
              </div>
              <div>
                <label className="block text-xs font-semibold text-text-secondary dark:text-neutral-500 uppercase tracking-wider mb-1.5">{t("info.mfa")}</label>
                <span className={`inline-flex items-center px-2 py-0.5 text-[11px] font-medium ${user.totpEnabled ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400" : "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400"}`} style={{ borderRadius: 4 }}>
                  {user.totpEnabled ? t("info.mfaEnabled") : t("info.mfaDisabled")}
                </span>
              </div>
            </div>
          </div>
        )}

        {activeTab === "password" && (
          <form onSubmit={handleChangePassword} className="p-6">
            <h2 className="text-lg font-bold text-black dark:text-white mb-6">{t("password.title")}</h2>
            <div className="flex flex-col gap-4 max-w-md">
              <div>
                <label className="block text-xs font-semibold text-text-secondary dark:text-neutral-500 uppercase tracking-wider mb-1.5">{t("password.current")}</label>
                <div className="relative">
                  <input type={showCurrentPw ? "text" : "password"} value={pwForm.currentPassword} onChange={(e) => setPwForm({ ...pwForm, currentPassword: e.target.value })} className="input w-full pr-10" required />
                  <button type="button" onClick={() => setShowCurrentPw(!showCurrentPw)} className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-neutral-400 hover:text-black dark:hover:text-white cursor-pointer">
                    <svg className="size-4" viewBox="0 0 16 16" fill="none">
                      {showCurrentPw ? (<><path d="M1 8s2.5-5 7-5 7 5 7 5-2.5 5-7 5-7-5-7-5z" stroke="currentColor" strokeWidth="1.3" /><circle cx="8" cy="8" r="2" stroke="currentColor" strokeWidth="1.3" /></>) : (<><path d="M1 8s2.5-5 7-5 7 5 7 5-2.5 5-7 5-7-5-7-5z" stroke="currentColor" strokeWidth="1.3" /><path d="M2 14L14 2" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" /></>)}
                    </svg>
                  </button>
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-text-secondary dark:text-neutral-500 uppercase tracking-wider mb-1.5">{t("password.new")}</label>
                <div className="relative">
                  <input type={showNewPw ? "text" : "password"} value={pwForm.newPassword} onChange={(e) => setPwForm({ ...pwForm, newPassword: e.target.value })} className="input w-full pr-10" required minLength={12} />
                  <button type="button" onClick={() => setShowNewPw(!showNewPw)} className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-neutral-400 hover:text-black dark:hover:text-white cursor-pointer">
                    <svg className="size-4" viewBox="0 0 16 16" fill="none">
                      {showNewPw ? (<><path d="M1 8s2.5-5 7-5 7 5 7 5-2.5 5-7 5-7-5-7-5z" stroke="currentColor" strokeWidth="1.3" /><circle cx="8" cy="8" r="2" stroke="currentColor" strokeWidth="1.3" /></>) : (<><path d="M1 8s2.5-5 7-5 7 5 7 5-2.5 5-7 5-7-5-7-5z" stroke="currentColor" strokeWidth="1.3" /><path d="M2 14L14 2" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" /></>)}
                    </svg>
                  </button>
                </div>
                <p className="text-[11px] text-neutral-400 mt-1">{t("password.minLength")}</p>
              </div>
              <div>
                <label className="block text-xs font-semibold text-text-secondary dark:text-neutral-500 uppercase tracking-wider mb-1.5">{t("password.confirm")}</label>
                <input type="password" value={pwForm.confirmPassword} onChange={(e) => setPwForm({ ...pwForm, confirmPassword: e.target.value })} className="input w-full" required />
              </div>
              <button type="submit" disabled={changingPw} className="primary-icon px-5 py-2.5 active-scale w-fit mt-2">
                <p className="text-sm font-medium">{changingPw ? t("password.submitting") : t("password.submit")}</p>
              </button>
            </div>
          </form>
        )}

        {activeTab === "mfa" && (
          <div className="p-6">
            <h2 className="text-lg font-bold text-black dark:text-white mb-2">{t("mfa.title")}</h2>
            <p className="text-sm text-text-secondary dark:text-neutral-500 mb-6">{t("mfa.description")}</p>

            {user.totpEnabled ? (
              <div className="flex flex-col gap-4 max-w-md">
                <div className="flex items-center gap-3 p-4 rounded-xl bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800">
                  <svg className="size-5 text-emerald-600 dark:text-emerald-400 shrink-0" viewBox="0 0 16 16" fill="none"><circle cx="8" cy="8" r="6.5" stroke="currentColor" strokeWidth="1.3" /><path d="M5.5 8l2 2 3.5-3.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" /></svg>
                  <p className="text-sm font-medium text-emerald-700 dark:text-emerald-400">{t("mfa.enabled")}</p>
                </div>
                <form onSubmit={handleDisableMfa} className="flex flex-col gap-3">
                  <label className="block text-xs font-semibold text-text-secondary dark:text-neutral-500 uppercase tracking-wider">{t("mfa.disableCode")}</label>
                  <input type="text" value={disableCode} onChange={(e) => setDisableCode(e.target.value)} placeholder="000000" className="input w-48" maxLength={6} />
                  <button type="submit" disabled={disablingMfa} className="secondary-icon px-4 py-2 active-scale w-fit">
                    <p className="text-sm font-medium">{disablingMfa ? t("mfa.disabling") : t("mfa.disable")}</p>
                  </button>
                </form>
              </div>
            ) : mfaSetup ? (
              <div className="flex flex-col gap-4 max-w-md">
                <div className="p-4 rounded-xl bg-neutral-50 dark:bg-neutral-800 border border-border dark:border-neutral-700 flex flex-col items-center gap-3">
                  <p className="text-xs font-semibold text-text-secondary dark:text-neutral-500 uppercase tracking-wider self-start">{t("mfa.scanQr")}</p>
                  {qrDataUrl ? (
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img
                      src={qrDataUrl}
                      alt={t("mfa.scanQr")}
                      width={220}
                      height={220}
                      className="rounded-lg bg-white p-2"
                    />
                  ) : (
                    <div className="size-[220px] rounded-lg bg-neutral-100 dark:bg-neutral-700 animate-pulse" />
                  )}
                  <p className="text-[11px] text-neutral-400 text-center">{t("mfa.scanQrHelp")}</p>

                  <div className="w-full pt-3 border-t border-border dark:border-neutral-700">
                    <p className="text-xs font-semibold text-text-secondary dark:text-neutral-500 uppercase tracking-wider mb-2">{t("mfa.secretKey")}</p>
                    <div className="flex items-center gap-2">
                      <code className="flex-1 text-sm font-mono font-bold text-black dark:text-white break-all">{mfaSetup.secret}</code>
                      <button
                        type="button"
                        onClick={copySecret}
                        className="shrink-0 px-3 py-1.5 rounded-lg border border-border dark:border-neutral-700 text-xs font-medium text-text-secondary dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-700 transition-colors cursor-pointer"
                      >
                        {secretCopied ? t("mfa.secretCopied") : t("mfa.copySecret")}
                      </button>
                    </div>
                    <p className="text-[11px] text-neutral-400 mt-2">{t("mfa.addToApp")}</p>
                  </div>
                </div>
                <form onSubmit={handleEnableMfa} className="flex flex-col gap-3">
                  <label className="block text-xs font-semibold text-text-secondary dark:text-neutral-500 uppercase tracking-wider">{t("mfa.verificationCode")}</label>
                  <input type="text" value={mfaCode} onChange={(e) => setMfaCode(e.target.value)} placeholder="000000" className="input w-48" maxLength={6} />
                  <button type="submit" disabled={enablingMfa} className="primary-icon px-5 py-2.5 active-scale w-fit">
                    <p className="text-sm font-medium">{enablingMfa ? t("mfa.enabling") : t("mfa.enable")}</p>
                  </button>
                </form>
              </div>
            ) : (
              <button onClick={handleSetupMfa} className="primary-icon px-5 py-2.5 active-scale">
                <span className="flex items-center gap-2">
                  <svg className="size-4" viewBox="0 0 16 16" fill="none"><rect x="2" y="4" width="12" height="10" rx="2" stroke="currentColor" strokeWidth="1.3" /><path d="M5 4V3a3 3 0 016 0v1" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" /><circle cx="8" cy="9.5" r="1.5" stroke="currentColor" strokeWidth="1.3" /></svg>
                  <p className="text-sm font-medium">{t("mfa.setup")}</p>
                </span>
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
