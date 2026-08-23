import { getRequestConfig } from "next-intl/server";
import { cookies } from "next/headers";

export const SUPPORTED_LOCALES = [
  "fr", "en", "ar", "bg", "ca", "cs", "da", "de", "el", "es", "es-419",
  "et", "fi", "fil", "he", "hi", "hr", "hu", "id", "it", "ja", "ko",
  "lt", "lv", "ms", "mt", "nb", "nl", "pl", "pt", "pt-BR", "ro", "ru",
  "sk", "sl", "sr", "sv", "sw", "th", "tr", "uk", "vi", "zh", "zh-HK",
  "zh-TW", "zu",
] as const;

export type Locale = (typeof SUPPORTED_LOCALES)[number];

type Messages = { [key: string]: string | Messages };

/**
 * Fusionne les traductions d'une locale par-dessus le francais.
 * Le francais est la langue de reference : toute cle absente d'une traduction
 * retombe sur son libelle francais au lieu d'afficher le chemin brut de la cle
 * (comportement par defaut de next-intl, qui casserait l'affichage).
 */
function mergeWithFallback(fallback: Messages, translated: Messages): Messages {
  const merged: Messages = { ...fallback };
  for (const key of Object.keys(translated)) {
    const value = translated[key];
    const base = fallback[key];
    if (typeof value === "object" && value !== null && typeof base === "object" && base !== null) {
      merged[key] = mergeWithFallback(base, value);
    } else if (typeof value === "string" && value.trim() !== "") {
      merged[key] = value;
    }
  }
  return merged;
}

export default getRequestConfig(async () => {
  const cookieStore = await cookies();
  const raw = cookieStore.get("locale")?.value || "fr";
  const locale = SUPPORTED_LOCALES.includes(raw as Locale) ? raw : "fr";

  const fallback = (await import("../../messages/fr.json")).default as Messages;
  if (locale === "fr") {
    return { locale, messages: fallback };
  }

  try {
    const translated = (await import(`../../messages/${locale}.json`)).default as Messages;
    return { locale, messages: mergeWithFallback(fallback, translated) };
  } catch {
    return { locale, messages: fallback };
  }
});
