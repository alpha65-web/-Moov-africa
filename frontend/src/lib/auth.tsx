"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { useRouter } from "next/navigation";
import api, { registerSessionHandlers, storeSession } from "./api";
import { clearSession, getSessionItem, setSessionItem } from "./session";
import type { LoginResponse, User } from "./types";

interface AuthContextType {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string, totpCode?: string) => Promise<void>;
  logout: () => void;
  applySession: (data: LoginResponse) => void;
  /** Recharge le profil depuis /users/me (role, permissions, etat de la 2FA). */
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    const token = getSessionItem("accessToken");
    const saved = getSessionItem("user");
    if (!token || !saved) {
      setLoading(false);
      return;
    }

    try {
      setUser(JSON.parse(saved));
    } catch {
      clearSession();
      setLoading(false);
      return;
    }

    // La copie en session peut dater : role, statut et permissions ont pu
    // changer depuis la derniere connexion. On resynchronise sur /users/me, dont
    // depend notamment le filtrage du menu par permission.
    api
      .get<User>("/users/me")
      .then(({ data }) => {
        setUser(data);
        setSessionItem("user", JSON.stringify(data));
      })
      .catch(() => {
        // L'intercepteur gere deja 401 et changement de mot de passe force :
        // on conserve la copie locale plutot que de deconnecter l'utilisateur.
      })
      .finally(() => setLoading(false));
  }, []);

  // Permet au client axios de naviguer sans toucher a window.location.
  useEffect(() => {
    registerSessionHandlers({
      onSessionExpired: () => {
        setUser(null);
        router.replace("/login");
      },
      onMfaSetupRequired: () => {
        router.replace("/profile");
      },
      onPasswordChangeRequired: () => {
        setUser((prev) =>
          prev && !prev.forcePasswordChange
            ? { ...prev, forcePasswordChange: true }
            : prev
        );
        router.replace("/profile");
      },
    });
  }, [router]);

  const refreshUser = useCallback(async () => {
    const { data } = await api.get<User>("/users/me");
    setUser(data);
    setSessionItem("user", JSON.stringify(data));
  }, []);

  const applySession = useCallback((data: LoginResponse) => {
    storeSession(data);
    setUser(data.user);
  }, []);

  const login = useCallback(
    async (email: string, password: string, totpCode?: string) => {
      const { data } = await api.post<LoginResponse>("/auth/login", {
        email,
        password,
        // Le backend refuse un totpCode vide : on ne l'envoie que s'il est saisi.
        ...(totpCode ? { totpCode } : {}),
      });
      applySession(data);
    },
    [applySession]
  );

  const logout = useCallback(async () => {
    // Doit partir AVANT le nettoyage : l'endpoint exige le jeton d'acces,
    // et c'est lui qui revoque le refresh token cote serveur.
    const refreshToken = getSessionItem("refreshToken");
    try {
      await api.post("/auth/logout", refreshToken ? { refreshToken } : undefined);
    } catch {
      // Une deconnexion locale doit aboutir meme si le serveur ne repond pas.
    }
    // Seule la session est effacee : le theme choisi et les brouillons de creation
    // d'utilisateur sont des preferences durables, que l'ancien localStorage.clear()
    // detruisait a chaque deconnexion.
    clearSession();
    setUser(null);
    router.push("/login");
  }, [router]);

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, applySession, refreshUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be inside AuthProvider");
  return ctx;
}
