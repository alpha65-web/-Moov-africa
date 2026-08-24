/**
 * Stockage de la session authentifiée.
 *
 * Les jetons étaient rangés dans `localStorage` : ils survivaient à la fermeture du
 * navigateur, si bien que relancer l'application rouvrait la session sans jamais
 * repasser par l'écran de connexion. Ils vivent désormais dans `sessionStorage`,
 * dont la durée de vie est celle de l'onglet : un rafraîchissement de page conserve
 * la session, la fermeture du navigateur la ferme.
 *
 * Les préférences qui ne relèvent pas de la session — thème, brouillons de création
 * d'utilisateur — restent dans `localStorage` et ne sont plus effacées à la
 * déconnexion, ce que faisait l'ancien `localStorage.clear()`.
 */

const KEYS = ["accessToken", "refreshToken", "fingerprint", "user"] as const;

type SessionKey = (typeof KEYS)[number];

function store(): Storage | null {
  if (typeof window === "undefined") return null;
  try {
    return window.sessionStorage;
  } catch {
    // Navigateur en navigation privée stricte ou stockage refusé.
    return null;
  }
}

export function getSessionItem(key: SessionKey): string | null {
  try {
    return store()?.getItem(key) ?? null;
  } catch {
    return null;
  }
}

export function setSessionItem(key: SessionKey, value: string) {
  try {
    store()?.setItem(key, value);
  } catch {
    /* Session non persistée : l'application reste utilisable le temps du chargement. */
  }
}

/** Efface la session sans toucher aux préférences durables de l'utilisateur. */
export function clearSession() {
  try {
    const s = store();
    KEYS.forEach((k) => s?.removeItem(k));
  } catch {
    /* rien à faire */
  }
}
