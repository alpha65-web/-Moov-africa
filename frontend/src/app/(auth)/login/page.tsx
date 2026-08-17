"use client";

import { useState, useRef, useEffect } from "react";
import { useAuth } from "@/lib/auth";

/* Icône loader — spinner custom */
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

export default function LoginPage() {
  const { login } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  /* Refs pour les animations lottie */
  const lottieRef = useRef<HTMLDivElement>(null);

  /* Charger et jouer une animation lottie */
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
      /* lottie-web pas installé — silencieux */
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      await login(email, password);
      setSuccess(true);
      playLottie("/lottie/success.json");
    } catch {
      setError("Adresse email ou mot de passe incorrect.");
      playLottie("/lottie/error.json");
    } finally {
      setLoading(false);
    }
  };

  /* Auto-focus sur l'input email au montage */
  const emailRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    emailRef.current?.focus();
  }, []);

  return (
    <form
      onSubmit={handleSubmit}
      className="relative z-30 inline-flex flex-col items-start justify-start w-full overflow-hidden bg-white dark:bg-neutral-900 border shadow-xl max-w-[400px] lg:max-w-[350px] rounded-2xl border-border dark:border-neutral-700"
    >
      {/* ===== PARTIE HAUTE — Titre + inputs ===== */}
      <div className="relative flex flex-col items-center self-stretch justify-start w-full gap-6 p-6 overflow-hidden border-b border-neutral-200 dark:border-neutral-700">
        {/* Zone animation lottie (success/error) */}
        <div className="w-full h-16" />
        <div
          ref={lottieRef}
          className="absolute left-0 flex items-center justify-center w-full h-12 top-16"
        />

        {/* Titre et sous-titre */}
        <div className="flex flex-col items-center self-stretch justify-center gap-1.5">
          <h4 className="text-2xl font-bold leading-tight text-center text-black dark:text-white">
            {success ? "Connexion réussie" : "Connexion"}
          </h4>
          <p className="text-sm font-normal leading-tight text-center text-stone-500 dark:text-neutral-400">
            {success
              ? "Redirection en cours..."
              : "Entrez vos identifiants professionnels"}
          </p>
        </div>

        {/* Champs de formulaire */}
        {!success && (
          <div className="flex flex-col items-start self-stretch justify-start w-full gap-4">
            {/* Email */}
            <div className="flex flex-col w-full gap-2 h-fit">
              <input
                ref={emailRef}
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="prenom.nom@moov-africa.bf"
                required
                className="input w-full"
              />
            </div>

            {/* Mot de passe */}
            <div className="flex flex-col w-full gap-2 h-fit">
              <div className="relative password-toggle">
                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Mot de passe"
                  required
                  className="input w-full pr-10"
                />
                {/* Toggle visibilité mot de passe */}
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-300 transition-colors"
                >
                  {showPassword ? (
                    <svg
                      className="w-4 h-4"
                      viewBox="0 0 16 16"
                      fill="none"
                    >
                      <path
                        d="M2 2l12 12M6.5 6.5a2 2 0 002.83 2.83M3.5 5.5C2.5 6.5 2 8 2 8s2 4 6 4c.8 0 1.5-.2 2.1-.5M14 8s-2-4-6-4c-.4 0-.8.05-1.1.13"
                        stroke="currentColor"
                        strokeWidth="1.2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  ) : (
                    <svg
                      className="w-4 h-4"
                      viewBox="0 0 16 16"
                      fill="none"
                    >
                      <path
                        d="M2 8s2-4 6-4 6 4 6 4-2 4-6 4-6-4-6-4z"
                        stroke="currentColor"
                        strokeWidth="1.2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                      <circle
                        cx="8"
                        cy="8"
                        r="2"
                        stroke="currentColor"
                        strokeWidth="1.2"
                      />
                    </svg>
                  )}
                </button>
              </div>
            </div>

            {/* Message d'erreur */}
            {error && (
              <p className="text-xs text-red-500 font-medium">{error}</p>
            )}
          </div>
        )}
      </div>

      {/* ===== PARTIE BASSE — Bouton submit ===== */}
      {!success && (
        <div className="self-stretch p-6 flex flex-col justify-start items-start gap-2.5 overflow-hidden">
          <button
            type="submit"
            disabled={loading}
            className="primary-icon w-full active-scale disabled:opacity-60 disabled:cursor-not-allowed"
          >
            <span className="flex items-center justify-center gap-2 w-full">
              {loading && (
                <LoaderIcon className="w-4 h-4 text-white animate-spin" />
              )}
              <p className="whitespace-nowrap text-sm">
                {loading ? "Connexion..." : "Se connecter"}
              </p>
            </span>
          </button>
        </div>
      )}
    </form>
  );
}
