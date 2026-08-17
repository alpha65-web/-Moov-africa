"use client";

import { useState, useRef, useEffect } from "react";
import { useLocale, useTranslations } from "next-intl";

const LANGUAGES: { code: string; label: string; flag: string }[] = [
  { code: "fr", label: "Français", flag: "🇫🇷" },
  { code: "en", label: "English", flag: "🇬🇧" },
  { code: "ar", label: "العربية", flag: "🇸🇦" },
  { code: "bg", label: "Български", flag: "🇧🇬" },
  { code: "ca", label: "Català", flag: "🇪🇸" },
  { code: "cs", label: "Čeština", flag: "🇨🇿" },
  { code: "da", label: "Dansk", flag: "🇩🇰" },
  { code: "de", label: "Deutsch", flag: "🇩🇪" },
  { code: "el", label: "Ελληνικά", flag: "🇬🇷" },
  { code: "es", label: "Español", flag: "🇪🇸" },
  { code: "es-419", label: "Español (Latam)", flag: "🇲🇽" },
  { code: "et", label: "Eesti", flag: "🇪🇪" },
  { code: "fi", label: "Suomi", flag: "🇫🇮" },
  { code: "fil", label: "Filipino", flag: "🇵🇭" },
  { code: "he", label: "עברית", flag: "🇮🇱" },
  { code: "hi", label: "हिन्दी", flag: "🇮🇳" },
  { code: "hr", label: "Hrvatski", flag: "🇭🇷" },
  { code: "hu", label: "Magyar", flag: "🇭🇺" },
  { code: "id", label: "Bahasa Indonesia", flag: "🇮🇩" },
  { code: "it", label: "Italiano", flag: "🇮🇹" },
  { code: "ja", label: "日本語", flag: "🇯🇵" },
  { code: "ko", label: "한국어", flag: "🇰🇷" },
  { code: "lt", label: "Lietuvių", flag: "🇱🇹" },
  { code: "lv", label: "Latviešu", flag: "🇱🇻" },
  { code: "ms", label: "Bahasa Melayu", flag: "🇲🇾" },
  { code: "mt", label: "Malti", flag: "🇲🇹" },
  { code: "nb", label: "Norsk bokmål", flag: "🇳🇴" },
  { code: "nl", label: "Nederlands", flag: "🇳🇱" },
  { code: "pl", label: "Polski", flag: "🇵🇱" },
  { code: "pt", label: "Português", flag: "🇵🇹" },
  { code: "pt-BR", label: "Português (Brasil)", flag: "🇧🇷" },
  { code: "ro", label: "Română", flag: "🇷🇴" },
  { code: "ru", label: "Русский", flag: "🇷🇺" },
  { code: "sk", label: "Slovenčina", flag: "🇸🇰" },
  { code: "sl", label: "Slovenščina", flag: "🇸🇮" },
  { code: "sr", label: "Српски", flag: "🇷🇸" },
  { code: "sv", label: "Svenska", flag: "🇸🇪" },
  { code: "sw", label: "Kiswahili", flag: "🇰🇪" },
  { code: "th", label: "ไทย", flag: "🇹🇭" },
  { code: "tr", label: "Türkçe", flag: "🇹🇷" },
  { code: "uk", label: "Українська", flag: "🇺🇦" },
  { code: "vi", label: "Tiếng Việt", flag: "🇻🇳" },
  { code: "zh", label: "中文 (简体)", flag: "🇨🇳" },
  { code: "zh-HK", label: "中文 (香港)", flag: "🇭🇰" },
  { code: "zh-TW", label: "中文 (繁體)", flag: "🇹🇼" },
  { code: "zu", label: "isiZulu", flag: "🇿🇦" },
];

export default function LanguageSwitcher() {
  const locale = useLocale();
  const t = useTranslations("language");
  const tc = useTranslations("common");
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
        setSearch("");
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  function switchLocale(code: string) {
    document.cookie = `locale=${code};path=/;max-age=31536000;SameSite=Lax`;
    setOpen(false);
    setSearch("");
    window.location.reload();
  }

  const current = LANGUAGES.find((l) => l.code === locale) || LANGUAGES[0];
  const filtered = LANGUAGES.filter(
    (l) =>
      l.label.toLowerCase().includes(search.toLowerCase()) ||
      l.code.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 w-full px-3 py-2 rounded-lg text-sm hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
      >
        <span className="text-base">{current.flag}</span>
        <span className="text-neutral-600 dark:text-neutral-400 flex-1 text-left truncate">
          {current.label}
        </span>
        <svg className={`size-3.5 text-neutral-400 transition-transform ${open ? "rotate-180" : ""}`} viewBox="0 0 16 16" fill="none">
          <path d="M4 6l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      {open && (
        <div className="absolute bottom-full left-0 right-0 mb-1 bg-white dark:bg-neutral-900 border border-border dark:border-neutral-700 rounded-xl shadow-xl z-50 overflow-hidden animate-fade-in">
          <div className="p-2 border-b border-border dark:border-neutral-800">
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={tc("searchPlaceholder")}
              className="input w-full text-xs h-8"
              autoFocus
            />
          </div>
          <div className="max-h-56 overflow-y-auto hide-scrollbar">
            {filtered.map((lang) => (
              <button
                key={lang.code}
                onClick={() => switchLocale(lang.code)}
                className={`flex items-center gap-2.5 w-full px-3 py-2 text-sm transition-colors ${
                  lang.code === locale
                    ? "bg-primary/10 text-primary font-medium"
                    : "text-neutral-700 dark:text-neutral-300 hover:bg-neutral-50 dark:hover:bg-neutral-800"
                }`}
              >
                <span className="text-base">{lang.flag}</span>
                <span className="truncate">{lang.label}</span>
                {lang.code === locale && (
                  <svg className="size-3.5 ml-auto text-primary shrink-0" viewBox="0 0 16 16" fill="none">
                    <path d="M3 8l3.5 3.5L13 5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                )}
              </button>
            ))}
            {filtered.length === 0 && (
              <p className="px-3 py-4 text-xs text-neutral-400 text-center">{tc("noResults")}</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
