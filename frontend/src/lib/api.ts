import axios from "axios";
import type { LoginResponse } from "./types";
import { clearSession, getSessionItem, setSessionItem } from "./session";

const api = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL || "http://localhost:8092/api/v1",
  headers: { "Content-Type": "application/json" },
});

const PUBLIC_PATHS = ["/auth/login", "/auth/refresh"];

interface SessionHandlers {
  onSessionExpired: () => void;
  onPasswordChangeRequired: () => void;
  onMfaSetupRequired: () => void;
}

// Ce module n'est pas un composant React : il ne peut pas appeler useRouter.
// AuthProvider enregistre ici des callbacks qui, eux, naviguent via le router.
let handlers: SessionHandlers | null = null;

export function registerSessionHandlers(next: SessionHandlers) {
  handlers = next;
}

// /auth/login, /auth/refresh et /auth/change-password renvoient tous un LoginResponse.
export function storeSession(data: LoginResponse) {
  setSessionItem("accessToken", data.accessToken);
  setSessionItem("refreshToken", data.refreshToken);
  if (data.fingerprint) {
    setSessionItem("fingerprint", data.fingerprint);
  }
  if (data.user) {
    setSessionItem("user", JSON.stringify(data.user));
  }
}

api.interceptors.request.use((config) => {
  if (typeof window !== "undefined") {
    const isPublic = PUBLIC_PATHS.some((p) => config.url?.endsWith(p));
    if (!isPublic) {
      const token = getSessionItem("accessToken");
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }
      const fingerprint = getSessionItem("fingerprint");
      if (fingerprint) {
        config.headers["X-Fingerprint"] = fingerprint;
      }
    }
  }
  return config;
});

api.interceptors.response.use(
  (res) => res,
  async (error) => {
    const original = error.config;
    const status = error.response?.status;

    // Le backend refuse tous les endpoints sauf /users/me et /auth/change-password
    // tant que le mot de passe n'a pas ete change.
    if (status === 403 && error.response?.data?.code === "FORCE_PASSWORD_CHANGE") {
      handlers?.onPasswordChangeRequired();
      return Promise.reject(error);
    }

    // Les comptes administrateurs sont bloques sur tous les endpoints tant que la
    // double authentification n'est pas activee. On les emmene sur leur profil,
    // seul ecran depuis lequel l'enrolement est possible.
    if (status === 403 && error.response?.data?.code === "MFA_REQUIRED_FOR_ADMIN") {
      handlers?.onMfaSetupRequired();
      return Promise.reject(error);
    }

    if (status === 401 && !original._retry) {
      original._retry = true;
      const refreshToken = getSessionItem("refreshToken");
      if (refreshToken) {
        try {
          const { data } = await axios.post<LoginResponse>(
            `${api.defaults.baseURL}/auth/refresh`,
            { refreshToken }
          );
          storeSession(data);
          original.headers.Authorization = `Bearer ${data.accessToken}`;
          // /auth/refresh emet une NOUVELLE empreinte. Sans elle, le rejeu
          // repart avec l'ancienne et le backend repond 401 fingerprint invalide.
          if (data.fingerprint) {
            original.headers["X-Fingerprint"] = data.fingerprint;
          }
          return api(original);
        } catch {
          clearSession();
          handlers?.onSessionExpired();
        }
      }
    }
    return Promise.reject(error);
  }
);

/**
 * Extrait le message d'erreur renvoye par le backend.
 * Le GlobalExceptionHandler repond toujours un ApiError { status, message, timestamp }.
 * Si le serveur est injoignable, axios ne fournit pas de reponse : on le dit clairement
 * plutot que de laisser l'ecran afficher un faux succes.
 */
export function apiError(error: unknown, fallback: string): string {
  const err = error as {
    response?: { status?: number; data?: { message?: string; code?: string } };
    code?: string;
  };

  if (!err?.response) {
    return "Serveur injoignable. Verifiez que le backend est demarre.";
  }
  const status = err.response.status;
  if (status === 403 && err.response.data?.code === "MFA_REQUIRED_FOR_ADMIN") {
    return "Activez la double authentification depuis votre profil pour acceder a la plateforme.";
  }
  if (status === 403) return "Acces refuse : votre role ne dispose pas de cette permission.";
  if (status === 401) return "Session expiree. Reconnectez-vous.";

  const message = err.response.data?.message;
  return message && message.trim() ? message : fallback;
}

export default api;
