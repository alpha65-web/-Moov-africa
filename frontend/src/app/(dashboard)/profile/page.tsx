"use client";

import { useState } from "react";
import { useAuth } from "@/lib/auth";
import { ROLE_LABELS } from "@/lib/types";
import api from "@/lib/api";
import toast from "react-hot-toast";

export default function ProfilePage() {
  const { user } = useAuth();
  const [tab, setTab] = useState<"info" | "password" | "mfa">("info");

  const [pwForm, setPwForm] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  });
  const [changingPw, setChangingPw] = useState(false);
  const [showCurrentPw, setShowCurrentPw] = useState(false);
  const [showNewPw, setShowNewPw] = useState(false);

  const [mfaSetup, setMfaSetup] = useState<{ secret: string; uri: string } | null>(null);
  const [mfaCode, setMfaCode] = useState("");
  const [enablingMfa, setEnablingMfa] = useState(false);
  const [disablingMfa, setDisablingMfa] = useState(false);
  const [disableCode, setDisableCode] = useState("");

  async function handleChangePassword(e: React.FormEvent) {
    e.preventDefault();
    if (changingPw) return;
    if (pwForm.newPassword !== pwForm.confirmPassword) {
      toast.error("Les mots de passe ne correspondent pas");
      return;
    }
    if (pwForm.newPassword.length < 12) {
      toast.error("Le mot de passe doit contenir au moins 12 caractères");
      return;
    }
    setChangingPw(true);
    try {
      await api.post("/auth/change-password", {
        currentPassword: pwForm.currentPassword,
        newPassword: pwForm.newPassword,
      });
      toast.success("Mot de passe modifié avec succès");
      setPwForm({ currentPassword: "", newPassword: "", confirmPassword: "" });
    } catch {
      toast.error("Erreur lors du changement de mot de passe");
    } finally {
      setChangingPw(false);
    }
  }

  async function handleSetupMfa() {
    try {
      const { data } = await api.post("/auth/totp/setup");
      setMfaSetup(data);
    } catch {
      toast.error("Erreur lors de la configuration MFA");
    }
  }

  async function handleEnableMfa(e: React.FormEvent) {
    e.preventDefault();
    if (enablingMfa || !mfaCode) return;
    setEnablingMfa(true);
    try {
      await api.post("/auth/totp/enable", { code: mfaCode });
      toast.success("MFA activé avec succès");
      setMfaSetup(null);
      setMfaCode("");
    } catch {
      toast.error("Code invalide");
    } finally {
      setEnablingMfa(false);
    }
  }

  async function handleDisableMfa(e: React.FormEvent) {
    e.preventDefault();
    if (disablingMfa || !disableCode) return;
    setDisablingMfa(true);
    try {
      await api.delete("/auth/totp", { data: { code: disableCode } });
      toast.success("MFA désactivé");
      setDisableCode("");
    } catch {
      toast.error("Code invalide");
    } finally {
      setDisablingMfa(false);
    }
  }

  if (!user) return null;

  const TABS = [
    { key: "info" as const, label: "Informations" },
    { key: "password" as const, label: "Mot de passe" },
    { key: "mfa" as const, label: "Sécurité MFA" },
  ];

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <div className="flex items-center justify-center size-16 rounded-2xl bg-primary text-white text-2xl font-bold">
          {user.firstName?.[0]}{user.lastName?.[0]}
        </div>
        <div>
          <h1 className="text-2xl font-bold text-black dark:text-white">
            {user.firstName} {user.lastName}
          </h1>
          <p className="text-sm text-text-secondary dark:text-neutral-500 mt-0.5">
            {ROLE_LABELS[user.role] || user.role}
          </p>
        </div>
      </div>

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
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="rounded-2xl border border-border dark:border-neutral-800 bg-white dark:bg-neutral-900 shadow-card overflow-hidden">
        {tab === "info" && (
          <div className="p-6">
            <h2 className="text-lg font-bold text-black dark:text-white mb-6">Informations personnelles</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-xs font-semibold text-text-secondary dark:text-neutral-500 uppercase tracking-wider mb-1.5">Prénom</label>
                <p className="text-sm font-bold text-black dark:text-white">{user.firstName}</p>
              </div>
              <div>
                <label className="block text-xs font-semibold text-text-secondary dark:text-neutral-500 uppercase tracking-wider mb-1.5">Nom</label>
                <p className="text-sm font-bold text-black dark:text-white">{user.lastName}</p>
              </div>
              <div>
                <label className="block text-xs font-semibold text-text-secondary dark:text-neutral-500 uppercase tracking-wider mb-1.5">Email</label>
                <p className="text-sm font-bold text-black dark:text-white">{user.email}</p>
              </div>
              <div>
                <label className="block text-xs font-semibold text-text-secondary dark:text-neutral-500 uppercase tracking-wider mb-1.5">Rôle</label>
                <span className="inline-flex items-center px-2 py-0.5 text-[11px] font-medium bg-black text-white dark:bg-white dark:text-black" style={{ borderRadius: 4 }}>
                  {ROLE_LABELS[user.role] || user.role}
                </span>
              </div>
              <div>
                <label className="block text-xs font-semibold text-text-secondary dark:text-neutral-500 uppercase tracking-wider mb-1.5">Statut</label>
                <span className="inline-flex items-center px-2 py-0.5 text-[11px] font-medium bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400" style={{ borderRadius: 4 }}>
                  {user.status === "ACTIVE" ? "Actif" : user.status}
                </span>
              </div>
              <div>
                <label className="block text-xs font-semibold text-text-secondary dark:text-neutral-500 uppercase tracking-wider mb-1.5">MFA</label>
                <span className={`inline-flex items-center px-2 py-0.5 text-[11px] font-medium ${user.totpEnabled ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400" : "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400"}`} style={{ borderRadius: 4 }}>
                  {user.totpEnabled ? "Activé" : "Désactivé"}
                </span>
              </div>
            </div>
          </div>
        )}

        {tab === "password" && (
          <form onSubmit={handleChangePassword} className="p-6">
            <h2 className="text-lg font-bold text-black dark:text-white mb-6">Changer le mot de passe</h2>
            <div className="flex flex-col gap-4 max-w-md">
              <div>
                <label className="block text-xs font-semibold text-text-secondary dark:text-neutral-500 uppercase tracking-wider mb-1.5">Mot de passe actuel</label>
                <div className="relative">
                  <input
                    type={showCurrentPw ? "text" : "password"}
                    value={pwForm.currentPassword}
                    onChange={(e) => setPwForm({ ...pwForm, currentPassword: e.target.value })}
                    className="input w-full pr-10"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowCurrentPw(!showCurrentPw)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-neutral-400 hover:text-black dark:hover:text-white"
                  >
                    <svg className="size-4" viewBox="0 0 16 16" fill="none">
                      {showCurrentPw ? (
                        <>
                          <path d="M1 8s2.5-5 7-5 7 5 7 5-2.5 5-7 5-7-5-7-5z" stroke="currentColor" strokeWidth="1.3" />
                          <circle cx="8" cy="8" r="2" stroke="currentColor" strokeWidth="1.3" />
                        </>
                      ) : (
                        <>
                          <path d="M1 8s2.5-5 7-5 7 5 7 5-2.5 5-7 5-7-5-7-5z" stroke="currentColor" strokeWidth="1.3" />
                          <path d="M2 14L14 2" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
                        </>
                      )}
                    </svg>
                  </button>
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-text-secondary dark:text-neutral-500 uppercase tracking-wider mb-1.5">Nouveau mot de passe</label>
                <div className="relative">
                  <input
                    type={showNewPw ? "text" : "password"}
                    value={pwForm.newPassword}
                    onChange={(e) => setPwForm({ ...pwForm, newPassword: e.target.value })}
                    className="input w-full pr-10"
                    required
                    minLength={12}
                  />
                  <button
                    type="button"
                    onClick={() => setShowNewPw(!showNewPw)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-neutral-400 hover:text-black dark:hover:text-white"
                  >
                    <svg className="size-4" viewBox="0 0 16 16" fill="none">
                      {showNewPw ? (
                        <>
                          <path d="M1 8s2.5-5 7-5 7 5 7 5-2.5 5-7 5-7-5-7-5z" stroke="currentColor" strokeWidth="1.3" />
                          <circle cx="8" cy="8" r="2" stroke="currentColor" strokeWidth="1.3" />
                        </>
                      ) : (
                        <>
                          <path d="M1 8s2.5-5 7-5 7 5 7 5-2.5 5-7 5-7-5-7-5z" stroke="currentColor" strokeWidth="1.3" />
                          <path d="M2 14L14 2" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
                        </>
                      )}
                    </svg>
                  </button>
                </div>
                <p className="text-[11px] text-neutral-400 mt-1">Minimum 12 caractères</p>
              </div>
              <div>
                <label className="block text-xs font-semibold text-text-secondary dark:text-neutral-500 uppercase tracking-wider mb-1.5">Confirmer le mot de passe</label>
                <input
                  type="password"
                  value={pwForm.confirmPassword}
                  onChange={(e) => setPwForm({ ...pwForm, confirmPassword: e.target.value })}
                  className="input w-full"
                  required
                />
              </div>
              <button
                type="submit"
                disabled={changingPw}
                className="primary-icon px-5 py-2.5 active-scale w-fit mt-2"
              >
                <p className="text-sm font-medium">{changingPw ? "Modification..." : "Modifier le mot de passe"}</p>
              </button>
            </div>
          </form>
        )}

        {tab === "mfa" && (
          <div className="p-6">
            <h2 className="text-lg font-bold text-black dark:text-white mb-2">Authentification à deux facteurs (MFA)</h2>
            <p className="text-sm text-text-secondary dark:text-neutral-500 mb-6">
              Protégez votre compte avec une application d&apos;authentification (Google Authenticator, Authy, etc.)
            </p>

            {user.totpEnabled ? (
              <div className="flex flex-col gap-4 max-w-md">
                <div className="flex items-center gap-3 p-4 rounded-xl bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800">
                  <svg className="size-5 text-emerald-600 dark:text-emerald-400 shrink-0" viewBox="0 0 16 16" fill="none">
                    <circle cx="8" cy="8" r="6.5" stroke="currentColor" strokeWidth="1.3" />
                    <path d="M5.5 8l2 2 3.5-3.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                  <p className="text-sm font-medium text-emerald-700 dark:text-emerald-400">MFA est activé sur votre compte</p>
                </div>

                <form onSubmit={handleDisableMfa} className="flex flex-col gap-3">
                  <label className="block text-xs font-semibold text-text-secondary dark:text-neutral-500 uppercase tracking-wider">Code TOTP pour désactiver</label>
                  <input
                    type="text"
                    value={disableCode}
                    onChange={(e) => setDisableCode(e.target.value)}
                    placeholder="000000"
                    className="input w-48"
                    maxLength={6}
                  />
                  <button
                    type="submit"
                    disabled={disablingMfa}
                    className="secondary-icon px-4 py-2 active-scale w-fit"
                  >
                    <p className="text-sm font-medium">{disablingMfa ? "Désactivation..." : "Désactiver MFA"}</p>
                  </button>
                </form>
              </div>
            ) : mfaSetup ? (
              <div className="flex flex-col gap-4 max-w-md">
                <div className="p-4 rounded-xl bg-neutral-50 dark:bg-neutral-800 border border-border dark:border-neutral-700">
                  <p className="text-xs font-semibold text-text-secondary dark:text-neutral-500 uppercase tracking-wider mb-2">Clé secrète</p>
                  <code className="text-sm font-mono font-bold text-black dark:text-white break-all">{mfaSetup.secret}</code>
                  <p className="text-[11px] text-neutral-400 mt-2">Ajoutez cette clé dans votre application d&apos;authentification</p>
                </div>
                <form onSubmit={handleEnableMfa} className="flex flex-col gap-3">
                  <label className="block text-xs font-semibold text-text-secondary dark:text-neutral-500 uppercase tracking-wider">Code de vérification</label>
                  <input
                    type="text"
                    value={mfaCode}
                    onChange={(e) => setMfaCode(e.target.value)}
                    placeholder="000000"
                    className="input w-48"
                    maxLength={6}
                  />
                  <button
                    type="submit"
                    disabled={enablingMfa}
                    className="primary-icon px-5 py-2.5 active-scale w-fit"
                  >
                    <p className="text-sm font-medium">{enablingMfa ? "Activation..." : "Activer MFA"}</p>
                  </button>
                </form>
              </div>
            ) : (
              <button
                onClick={handleSetupMfa}
                className="primary-icon px-5 py-2.5 active-scale"
              >
                <span className="flex items-center gap-2">
                  <svg className="size-4" viewBox="0 0 16 16" fill="none">
                    <rect x="2" y="4" width="12" height="10" rx="2" stroke="currentColor" strokeWidth="1.3" />
                    <path d="M5 4V3a3 3 0 016 0v1" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
                    <circle cx="8" cy="9.5" r="1.5" stroke="currentColor" strokeWidth="1.3" />
                  </svg>
                  <p className="text-sm font-medium">Configurer MFA</p>
                </span>
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
