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

export default getRequestConfig(async () => {
  const cookieStore = await cookies();
  const raw = cookieStore.get("locale")?.value || "fr";
  const locale = SUPPORTED_LOCALES.includes(raw as Locale) ? raw : "fr";

  let messages;
  try {
    messages = (await import(`../../messages/${locale}.json`)).default;
  } catch {
    messages = (await import("../../messages/fr.json")).default;
  }

  return { locale, messages };
});
