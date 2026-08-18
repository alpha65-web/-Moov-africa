"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/lib/auth";
import { useTranslations } from "next-intl";

const ROUTE_META: Record<string, { titleKey: string; subtitleKey?: string }> = {
  "/": { titleKey: "dashboard", subtitleKey: "dashboardSub" },
  "/catalog": { titleKey: "catalog", subtitleKey: "catalogSub" },
  "/offers": { titleKey: "offers", subtitleKey: "offersSub" },
  "/campaigns": { titleKey: "campaigns", subtitleKey: "campaignsSub" },
  "/media": { titleKey: "media", subtitleKey: "mediaSub" },
  "/rules": { titleKey: "rules", subtitleKey: "rulesSub" },
  "/users": { titleKey: "users", subtitleKey: "usersSub" },
  "/notifications": { titleKey: "notifications", subtitleKey: "notificationsSub" },
  "/audit": { titleKey: "audit", subtitleKey: "auditSub" },
  "/settings": { titleKey: "settings", subtitleKey: "settingsSub" },
  "/profile": { titleKey: "profile", subtitleKey: "profileSub" },
};

export default function AppBar() {
  const { user, logout } = useAuth();
  const pathname = usePathname();
  const t = useTranslations("appbar");
  const ts = useTranslations("sidebar");
  const [profileOpen, setProfileOpen] = useState(false);
  const profileRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (profileRef.current && !profileRef.current.contains(e.target as Node)) {
        setProfileOpen(false);
      }
    }
    if (profileOpen) document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [profileOpen]);

  const matched = Object.entries(ROUTE_META).find(
    ([path]) => path === "/" ? pathname === "/" : pathname.startsWith(path)
  );
  const meta = matched?.[1] ?? { titleKey: "dashboard" };
  const title = ts.has(meta.titleKey) ? ts(meta.titleKey) : meta.titleKey;
  const subtitle = meta.subtitleKey && t.has(meta.subtitleKey) ? t(meta.subtitleKey) : undefined;

  return (
    <header className="sticky top-0 z-30 flex items-center justify-between gap-4 px-6 py-3.5 bg-bg/80 dark:bg-neutral-950/80 backdrop-blur-xl border-b border-neutral-200/60 dark:border-white/[0.06]">
      {/* Left: Title + subtitle */}
      <div className="min-w-0">
        <h1 className="text-[15px] font-semibold text-neutral-900 dark:text-white tracking-tight truncate">
          {title}
        </h1>
        {subtitle && (
          <p className="text-[12px] text-neutral-500 dark:text-neutral-500 mt-0.5 truncate">{subtitle}</p>
        )}
      </div>

      {/* Right: Search + Profile */}
      <div className="flex items-center gap-2.5 shrink-0">
        {/* Search trigger */}
        <button
          onClick={() => window.dispatchEvent(new KeyboardEvent("keydown", { key: "k", ctrlKey: true }))}
          className="flex items-center gap-2 h-8 px-3 rounded-lg text-xs text-neutral-400 dark:text-neutral-500 bg-white dark:bg-white/[0.04] ring-1 ring-neutral-200/80 dark:ring-white/[0.08] hover:ring-neutral-300 dark:hover:ring-white/[0.12] transition-all cursor-pointer"
        >
          <svg className="size-3.5 shrink-0" viewBox="0 0 20 20" fill="none">
            <circle cx="9" cy="9" r="5.5" stroke="currentColor" strokeWidth="1.5" />
            <path d="M13.5 13.5L17 17" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
          <span className="hidden sm:inline text-neutral-400 dark:text-neutral-500">{t("search")}</span>
          <kbd className="hidden md:inline-flex items-center px-1.5 py-0.5 rounded border border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-800 text-[10px] font-semibold text-neutral-400 dark:text-neutral-500 ml-3">
            Ctrl K
          </kbd>
        </button>

        {/* Notifications bell */}
        <Link
          href="/notifications"
          className="relative flex items-center justify-center size-8 rounded-lg hover:bg-neutral-100 dark:hover:bg-white/[0.04] transition-colors"
        >
          <svg className="size-4 text-neutral-500 dark:text-neutral-400" viewBox="0 0 20 20" fill="none">
            <path d="M10 2a5 5 0 00-5 5c0 3.5-1.5 5.5-2 6h14c-.5-.5-2-2.5-2-6a5 5 0 00-5-5z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
            <path d="M8 15a2 2 0 004 0" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
        </Link>

        {/* Profile dropdown */}
        <div className="relative" ref={profileRef}>
          <button
            onClick={() => setProfileOpen(prev => !prev)}
            className="flex items-center gap-2.5 h-8 pl-1 pr-2.5 rounded-lg hover:bg-neutral-100 dark:hover:bg-white/[0.04] transition-colors cursor-pointer"
          >
            <div className="flex items-center justify-center size-6 rounded-full bg-primary text-white text-[10px] font-bold shrink-0">
              {user?.firstName?.[0]}{user?.lastName?.[0]}
            </div>
            <span className="hidden lg:inline text-[13px] font-medium text-neutral-700 dark:text-neutral-300 max-w-[120px] truncate">
              {user?.firstName}
            </span>
            <svg className={`size-3 text-neutral-400 transition-transform ${profileOpen ? "rotate-180" : ""}`} viewBox="0 0 12 12" fill="none">
              <path d="M3 4.5l3 3 3-3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>

          {/* Dropdown menu */}
          {profileOpen && (
            <div className="absolute right-0 top-full mt-1.5 w-56 rounded-xl bg-white dark:bg-neutral-900 ring-1 ring-neutral-200/80 dark:ring-white/[0.08] shadow-lg overflow-hidden animate-fade-in">
              {/* User info */}
              <div className="px-4 py-3 border-b border-neutral-100 dark:border-white/[0.06]">
                <p className="text-[13px] font-semibold text-neutral-900 dark:text-white truncate">
                  {user?.firstName} {user?.lastName}
                </p>
                <p className="text-[11px] text-neutral-400 dark:text-neutral-500 truncate mt-0.5">
                  {user?.email}
                </p>
              </div>

              {/* Actions */}
              <div className="py-1.5">
                <Link
                  href="/profile"
                  onClick={() => setProfileOpen(false)}
                  className="flex items-center gap-3 px-4 py-2 text-[13px] text-neutral-700 dark:text-neutral-300 hover:bg-neutral-50 dark:hover:bg-white/[0.04] transition-colors"
                >
                  <svg className="size-4 text-neutral-400" viewBox="0 0 20 20" fill="none">
                    <circle cx="10" cy="7" r="3.5" stroke="currentColor" strokeWidth="1.5" />
                    <path d="M3 18c0-3.3 3.1-6 7-6s7 2.7 7 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                  </svg>
                  {t("editProfile")}
                </Link>
                <Link
                  href="/settings"
                  onClick={() => setProfileOpen(false)}
                  className="flex items-center gap-3 px-4 py-2 text-[13px] text-neutral-700 dark:text-neutral-300 hover:bg-neutral-50 dark:hover:bg-white/[0.04] transition-colors"
                >
                  <svg className="size-4 text-neutral-400" viewBox="0 0 20 20" fill="none">
                    <circle cx="10" cy="10" r="3" stroke="currentColor" strokeWidth="1.5" />
                    <path d="M10 2v2M10 16v2M2 10h2M16 10h2M4.93 4.93l1.41 1.41M13.66 13.66l1.41 1.41M4.93 15.07l1.41-1.41M13.66 6.34l1.41-1.41" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                  </svg>
                  {t("settings")}
                </Link>
              </div>

              {/* Logout */}
              <div className="border-t border-neutral-100 dark:border-white/[0.06] py-1.5">
                <button
                  onClick={() => { setProfileOpen(false); logout(); }}
                  className="flex items-center gap-3 w-full px-4 py-2 text-[13px] text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors cursor-pointer"
                >
                  <svg className="size-4" viewBox="0 0 20 20" fill="none">
                    <path d="M7 3H4a1 1 0 00-1 1v12a1 1 0 001 1h3M13 14l4-4-4-4M17 10H8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                  {t("logout")}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
