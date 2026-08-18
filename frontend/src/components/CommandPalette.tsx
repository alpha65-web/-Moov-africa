"use client";

import { useEffect, useState, useRef, useMemo, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import api from "@/lib/api";
import type { Offer, CatalogItem } from "@/lib/types";

interface PaletteItem {
  id: string;
  label: string;
  detail?: string;
  section: string;
  icon: "nav" | "offer" | "catalog" | "campaign" | "action" | "user";
  action: () => void;
}

const NAV_PAGES = [
  { key: "dashboard", href: "/", icon: "nav" as const },
  { key: "catalog", href: "/catalog", icon: "nav" as const },
  { key: "offers", href: "/offers", icon: "nav" as const },
  { key: "campaigns", href: "/campaigns", icon: "nav" as const },
  { key: "media", href: "/media", icon: "nav" as const },
  { key: "rules", href: "/rules", icon: "nav" as const },
  { key: "users", href: "/users", icon: "nav" as const },
  { key: "notifications", href: "/notifications", icon: "nav" as const },
  { key: "audit", href: "/audit", icon: "nav" as const },
  { key: "settings", href: "/settings", icon: "nav" as const },
];

function IconForType({ type }: { type: PaletteItem["icon"] }) {
  const cls = "size-4 shrink-0";
  switch (type) {
    case "nav":
      return <svg className={cls} viewBox="0 0 20 20" fill="none"><path d="M7 4l6 6-6 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>;
    case "offer":
      return <svg className={cls} viewBox="0 0 20 20" fill="none"><path d="M10 2l2.5 5 5.5.8-4 3.9.9 5.3L10 14.5 5.1 17l.9-5.3-4-3.9 5.5-.8L10 2z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" /></svg>;
    case "catalog":
      return <svg className={cls} viewBox="0 0 20 20" fill="none"><rect x="3" y="2" width="14" height="16" rx="2" stroke="currentColor" strokeWidth="1.5" /><path d="M7 6h6M7 10h4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" /></svg>;
    case "campaign":
      return <svg className={cls} viewBox="0 0 20 20" fill="none"><path d="M3 10l4-6v12l-4-6zM7 5l9-2v14l-9-2V5z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" /></svg>;
    case "action":
      return <svg className={cls} viewBox="0 0 20 20" fill="none"><path d="M10 3v14M3 10h14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" /></svg>;
    case "user":
      return <svg className={cls} viewBox="0 0 20 20" fill="none"><circle cx="10" cy="7" r="3.5" stroke="currentColor" strokeWidth="1.5" /><path d="M3 18c0-3.3 3.1-6 7-6s7 2.7 7 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" /></svg>;
  }
}

export default function CommandPalette() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const [offers, setOffers] = useState<Offer[]>([]);
  const [catalogItems, setCatalogItems] = useState<CatalogItem[]>([]);
  const [loaded, setLoaded] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const router = useRouter();
  const t = useTranslations("commandPalette");
  const tn = useTranslations("sidebar");

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setOpen(prev => !prev);
      }
      if (e.key === "Escape") setOpen(false);
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  useEffect(() => {
    if (open) {
      setQuery("");
      setActiveIndex(0);
      setTimeout(() => inputRef.current?.focus(), 50);
      if (!loaded) {
        Promise.all([
          api.get("/offers").catch(() => ({ data: [] })),
          api.get("/catalog").catch(() => ({ data: [] })),
        ]).then(([offersRes, catalogRes]) => {
          setOffers(offersRes.data.content ?? offersRes.data ?? []);
          setCatalogItems(Array.isArray(catalogRes.data) ? catalogRes.data : []);
          setLoaded(true);
        });
      }
    }
  }, [open, loaded]);

  const go = useCallback((href: string) => {
    setOpen(false);
    router.push(href);
  }, [router]);

  const items = useMemo<PaletteItem[]>(() => {
    const all: PaletteItem[] = [];

    NAV_PAGES.forEach(p => {
      all.push({
        id: `nav-${p.key}`,
        label: tn(p.key),
        section: t("navigation"),
        icon: p.icon,
        action: () => go(p.href),
      });
    });

    all.push(
      { id: "act-offer", label: t("createOffer"), section: t("actions"), icon: "action", action: () => go("/offers") },
      { id: "act-product", label: t("addProduct"), section: t("actions"), icon: "action", action: () => go("/catalog") },
      { id: "act-campaign", label: t("launchCampaign"), section: t("actions"), icon: "action", action: () => go("/campaigns") },
    );

    offers.slice(0, 20).forEach(o => {
      all.push({
        id: `offer-${o.id}`,
        label: o.name,
        detail: o.shortDescription,
        section: t("offers"),
        icon: "offer",
        action: () => go("/offers"),
      });
    });

    catalogItems.slice(0, 20).forEach(c => {
      all.push({
        id: `cat-${c.id}`,
        label: c.name,
        detail: c.type,
        section: t("catalog"),
        icon: "catalog",
        action: () => go("/catalog"),
      });
    });

    return all;
  }, [tn, t, go, offers, catalogItems]);

  const filtered = useMemo(() => {
    if (!query.trim()) return items;
    const q = query.toLowerCase();
    return items.filter(item =>
      item.label.toLowerCase().includes(q) ||
      item.detail?.toLowerCase().includes(q) ||
      item.section.toLowerCase().includes(q)
    );
  }, [items, query]);

  const sections = useMemo(() => {
    const map = new Map<string, PaletteItem[]>();
    filtered.forEach(item => {
      if (!map.has(item.section)) map.set(item.section, []);
      map.get(item.section)!.push(item);
    });
    return map;
  }, [filtered]);

  useEffect(() => {
    setActiveIndex(0);
  }, [query]);

  useEffect(() => {
    const el = listRef.current?.querySelector(`[data-index="${activeIndex}"]`);
    el?.scrollIntoView({ block: "nearest" });
  }, [activeIndex]);

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex(i => Math.min(i + 1, filtered.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex(i => Math.max(i - 1, 0));
    } else if (e.key === "Enter" && filtered[activeIndex]) {
      e.preventDefault();
      filtered[activeIndex].action();
    }
  }

  if (!open) return null;

  let flatIdx = -1;

  return (
    <div className="fixed inset-0 z-[100] flex items-start justify-center pt-[15vh]" onClick={() => setOpen(false)}>
      <div className="fixed inset-0 bg-black/40 dark:bg-black/60 backdrop-blur-sm" />

      <div
        className="relative w-full max-w-[560px] rounded-2xl border border-border dark:border-neutral-700 bg-white dark:bg-neutral-900 shadow-2xl overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        {/* Search input */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-border dark:border-neutral-800">
          <svg className="size-5 text-text-secondary dark:text-neutral-500 shrink-0" viewBox="0 0 20 20" fill="none">
            <circle cx="9" cy="9" r="5.5" stroke="currentColor" strokeWidth="1.5" />
            <path d="M13.5 13.5L17 17" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder={t("placeholder")}
            className="flex-1 bg-transparent text-sm text-black dark:text-white placeholder:text-neutral-400 dark:placeholder:text-neutral-600 outline-none"
          />
          <kbd className="hidden sm:inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded border border-border dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-800 text-[10px] font-semibold text-text-secondary dark:text-neutral-500">ESC</kbd>
        </div>

        {/* Results */}
        <div ref={listRef} className="max-h-[360px] overflow-y-auto">
          {filtered.length === 0 ? (
            <div className="py-12 text-center">
              <p className="text-sm text-text-secondary dark:text-neutral-500">{t("noResults")}</p>
            </div>
          ) : (
            Array.from(sections.entries()).map(([section, sectionItems]) => (
              <div key={section}>
                <div className="px-4 pt-3 pb-1.5">
                  <span className="text-[10px] font-bold uppercase tracking-widest text-text-secondary dark:text-neutral-500">{section}</span>
                </div>
                {sectionItems.map(item => {
                  flatIdx++;
                  const idx = flatIdx;
                  const active = idx === activeIndex;
                  return (
                    <button
                      key={item.id}
                      data-index={idx}
                      onClick={item.action}
                      onMouseEnter={() => setActiveIndex(idx)}
                      className={`w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors ${active ? "bg-primary/8 dark:bg-primary/15" : "hover:bg-neutral-50 dark:hover:bg-neutral-800/50"}`}
                    >
                      <div className={`shrink-0 ${active ? "text-primary" : "text-text-secondary dark:text-neutral-500"}`}>
                        <IconForType type={item.icon} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <span className={`text-sm font-medium truncate block ${active ? "text-primary" : "text-black dark:text-white"}`}>{item.label}</span>
                        {item.detail && <span className="text-xs text-text-secondary dark:text-neutral-500 truncate block">{item.detail}</span>}
                      </div>
                      {active && (
                        <kbd className="hidden sm:inline-flex items-center px-1.5 py-0.5 rounded border border-border dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-800 text-[10px] font-semibold text-text-secondary dark:text-neutral-500">↵</kbd>
                      )}
                    </button>
                  );
                })}
              </div>
            ))
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-4 py-2.5 border-t border-border dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-800/50">
          <div className="flex items-center gap-3 text-[11px] text-text-secondary dark:text-neutral-500">
            <span className="flex items-center gap-1">
              <kbd className="inline-flex items-center px-1 py-0.5 rounded border border-border dark:border-neutral-700 bg-white dark:bg-neutral-800 text-[10px] font-semibold">↑↓</kbd>
              {t("navigate")}
            </span>
            <span className="flex items-center gap-1">
              <kbd className="inline-flex items-center px-1 py-0.5 rounded border border-border dark:border-neutral-700 bg-white dark:bg-neutral-800 text-[10px] font-semibold">↵</kbd>
              {t("select")}
            </span>
          </div>
          <span className="text-[11px] text-text-secondary dark:text-neutral-500 flex items-center gap-1">
            <kbd className="inline-flex items-center px-1 py-0.5 rounded border border-border dark:border-neutral-700 bg-white dark:bg-neutral-800 text-[10px] font-semibold">Ctrl</kbd>
            <kbd className="inline-flex items-center px-1 py-0.5 rounded border border-border dark:border-neutral-700 bg-white dark:bg-neutral-800 text-[10px] font-semibold">K</kbd>
          </span>
        </div>
      </div>
    </div>
  );
}
