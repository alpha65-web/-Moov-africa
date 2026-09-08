"use client";

import { useState, useRef, useEffect } from "react";
import { useLocale, useTranslations } from "next-intl";

// Les seules langues reellement traduites. Le filtre COMPLETE_LOCALES qui se
// trouvait ici masquait 44 locales dont les fichiers n'etaient que des copies du
// francais : ces fichiers ont ete supprimes, la liste se suffit desormais a
// elle-meme. Ajouter une entree suppose de livrer messages/<code>.json complet.
// Les drapeaux sont les images de public/flags/svg : un caractere emoji se
// rend differemment selon le systeme et n'a pas sa place dans l'interface.
const LANGUAGES: { code: string; label: string; flag: string }[] = [
  { code: "fr", label: "Français", flag: "/flags/svg/fr.svg" },
  { code: "en", label: "English", flag: "/flags/svg/gb.svg" },
];

function Flag({ src, alt }: { src: string; alt: string }) {
  // eslint-disable-next-line @next/next/no-img-element -- petite image statique locale, sans optimisation utile
  return <img src={src} alt={alt} width={18} height={13} className="h-[13px] w-[18px] rounded-[2px] object-cover shrink-0" />;
}

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
        className="flex items-center gap-2 w-full px-3 py-2 rounded-lg text-sm text-white/80 hover:bg-white/10 hover:text-white transition-colors cursor-pointer"
      >
        <Flag src={current.flag} alt={current.label} />
        <span className="flex-1 text-left truncate">
          {current.label}
        </span>
        <svg className={`size-3.5 text-white/60 transition-transform ${open ? "rotate-180" : ""}`} viewBox="0 0 16 16" fill="none">
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
                <Flag src={lang.flag} alt={lang.label} />
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
