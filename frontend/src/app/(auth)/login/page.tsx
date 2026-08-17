"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth";
import Image from "next/image";

function LoaderIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 16 16"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d="M8 1.5v3M8 11.5v3M1.5 8h3M11.5 8h3M3.4 3.4l2.12 2.12M10.48 10.48l2.12 2.12M3.4 12.6l2.12-2.12M10.48 5.52l2.12-2.12"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  );
}

function CheckIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="12" r="11" stroke="currentColor" strokeWidth="1.5" />
      <path d="M7 12.5l3 3 7-7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export default function LoginPage() {
  const { login } = useAuth();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [touched, setTouched] = useState({ email: false, password: false });

  const lottieRef = useRef<HTMLDivElement>(null);

  const playLottie = async (path: string) => {
    if (!lottieRef.current) return;
    try {
      const lottieModule = await import("lottie-web");
      const lottie = lottieModule.default;
      lottieRef.current.innerHTML = "";
      lottie.loadAnimation({
        container: lottieRef.current,
        renderer: "svg",
        loop: false,
        autoplay: true,
        path,
      });
    } catch {
      /* lottie-web pas disponible */
    }
  };

  const emailEmpty = touched.email && email.trim() === "";
  const passwordEmpty = touched.password && password.trim() === "";

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setTouched({ email: true, password: true });

    if (!email.trim() || !password.trim()) return;
    if (loading) return;

    setError(null);
    setLoading(true);

    try {
      await login(email, password);
      setSuccess(true);
      playLottie("/lottie/success.json");
      setTimeout(() => router.push("/"), 1200);
    } catch (err: unknown) {
      const axiosErr = err as { response?: { status?: number; data?: { message?: string } }; message?: string };
      const status = axiosErr.response?.status;
      if (status === 401) {
        setError("Adresse email ou mot de passe incorrect.");
      } else if (status === 423) {
        setError("Compte verrouillé. Contactez votre administrateur.");
      } else if (status === 403) {
        setError("Accès refusé. Vérifiez vos autorisations.");
      } else if (axiosErr.response?.data?.message) {
        setError(axiosErr.response.data.message);
      } else {
        setError("Impossible de contacter le serveur. Vérifiez que le backend est démarré.");
      }
      playLottie("/lottie/error.json");
      setLoading(false);
    }
  };

  const emailRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    emailRef.current?.focus();
  }, []);

  return (
    <form
      onSubmit={handleSubmit}
      noValidate
      className="relative z-30 flex flex-col w-full mx-4 sm:mx-0 max-w-[420px] lg:max-w-[380px] overflow-hidden bg-white dark:bg-neutral-900 border rounded-2xl border-border dark:border-neutral-700 shadow-lg"
    >
      {/* ===== EN-TÊTE — Logo + nom + description ===== */}
      <div className="flex flex-col items-center gap-4 px-6 sm:px-8 pt-6 sm:pt-8 pb-5 sm:pb-6">
        <div className="flex items-center justify-center">
          <Image
            src="/img/logo-light.jpeg"
            alt="Moov Africa"
            width={180}
            height={56}
            className="object-contain h-12 sm:h-14 w-auto dark:hidden"
          />
          <Image
            src="/img/logo-dark.jpeg"
            alt="Moov Africa"
            width={180}
            height={56}
            className="object-contain h-12 sm:h-14 w-auto hidden dark:block"
          />
        </div>

        <div className="flex flex-col items-center gap-1">
          <h1 className="text-lg sm:text-xl font-bold text-secondary dark:text-white tracking-tight">
            {success ? "Connexion réussie" : "PIM Moov Africa"}
          </h1>
          <p className="text-xs sm:text-sm text-text-secondary dark:text-neutral-400 text-center leading-relaxed">
            {success
              ? "Redirection vers votre espace..."
              : "Connectez-vous pour accéder à votre espace professionnel."}
          </p>
        </div>

        {/* Zone lottie / icône succès */}
        {success ? (
          <div className="flex flex-col items-center gap-2 py-2">
            <CheckIcon className="w-12 h-12 text-emerald-500 animate-[fadeScale_0.4s_ease-out]" />
          </div>
        ) : (
          <div
            ref={lottieRef}
            className="w-full h-8 flex items-center justify-center"
          />
        )}
      </div>

      {/* ===== FORMULAIRE ===== */}
      {!success && (
        <div className="flex flex-col gap-3.5 px-6 sm:px-8 pb-6 sm:pb-8">
          <div className="w-full h-px bg-border dark:bg-neutral-700" />

          {/* Email */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-text-secondary dark:text-neutral-400">
              Adresse email <span className="text-danger">*</span>
            </label>
            <input
              ref={emailRef}
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              onBlur={() => setTouched((t) => ({ ...t, email: true }))}
              placeholder="prenom.nom@moov-africa.bf"
              autoComplete="email"
              className={`input w-full h-10 ${emailEmpty ? "!border-danger" : ""}`}
            />
            {emailEmpty && (
              <p className="text-[11px] text-danger font-medium">
                L&apos;adresse email est requise.
              </p>
            )}
          </div>

          {/* Mot de passe */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-text-secondary dark:text-neutral-400">
              Mot de passe <span className="text-danger">*</span>
            </label>
            <div className="relative">
              <input
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onBlur={() => setTouched((t) => ({ ...t, password: true }))}
                placeholder="Mot de passe"
                autoComplete="current-password"
                className={`input w-full h-10 pr-10 ${passwordEmpty ? "!border-danger" : ""}`}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-300 transition-colors"
              >
                {showPassword ? (
                  <svg className="w-4 h-4" viewBox="0 0 16 16" fill="none">
                    <path
                      d="M2 2l12 12M6.5 6.5a2 2 0 002.83 2.83M3.5 5.5C2.5 6.5 2 8 2 8s2 4 6 4c.8 0 1.5-.2 2.1-.5M14 8s-2-4-6-4c-.4 0-.8.05-1.1.13"
                      stroke="currentColor"
                      strokeWidth="1.2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                ) : (
                  <svg className="w-4 h-4" viewBox="0 0 16 16" fill="none">
                    <path
                      d="M2 8s2-4 6-4 6 4 6 4-2 4-6 4-6-4-6-4z"
                      stroke="currentColor"
                      strokeWidth="1.2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                    <circle cx="8" cy="8" r="2" stroke="currentColor" strokeWidth="1.2" />
                  </svg>
                )}
              </button>
            </div>
            {passwordEmpty && (
              <p className="text-[11px] text-danger font-medium">
                Le mot de passe est requis.
              </p>
            )}
          </div>

          {/* Message d'erreur API */}
          {error && (
            <div className="flex items-start gap-2 p-3 rounded-lg bg-danger/5 border border-danger/20">
              <svg className="w-4 h-4 text-danger shrink-0 mt-0.5" viewBox="0 0 16 16" fill="none">
                <circle cx="8" cy="8" r="7" stroke="currentColor" strokeWidth="1.2" />
                <path d="M8 4.5v4M8 10.5v.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
              <p className="text-xs text-danger font-medium leading-relaxed">{error}</p>
            </div>
          )}

          {/* Bouton */}
          <button
            type="submit"
            disabled={loading}
            className="primary-icon w-full h-10 active-scale disabled:opacity-60 disabled:cursor-not-allowed mt-1"
          >
            <span className="flex items-center justify-center gap-2 w-full">
              {loading && (
                <LoaderIcon className="w-4 h-4 text-white animate-spin" />
              )}
              <p className="whitespace-nowrap text-sm font-medium">
                {loading ? "Connexion en cours..." : "Se connecter"}
              </p>
            </span>
          </button>
        </div>
      )}
    </form>
  );
}
