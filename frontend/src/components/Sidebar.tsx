"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import api from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { NOTIFICATIONS_UPDATED_EVENT } from "@/lib/notifications";
import ThemeToggle from "@/components/ThemeToggle";
import LanguageSwitcher from "@/components/LanguageSwitcher";
import { useTranslations } from "next-intl";

/* ===== ICÔNES SVG CUSTOM ===== */

function DashboardIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 20 20" fill="none">
      <rect x="2" y="2" width="7" height="7" rx="2" stroke="currentColor" strokeWidth="1.5" />
      <rect x="11" y="2" width="7" height="7" rx="2" stroke="currentColor" strokeWidth="1.5" />
      <rect x="2" y="11" width="7" height="7" rx="2" stroke="currentColor" strokeWidth="1.5" />
      <rect x="11" y="11" width="7" height="7" rx="2" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  );
}

function CatalogIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 20 20" fill="none">
      <rect x="3" y="2" width="14" height="16" rx="2" stroke="currentColor" strokeWidth="1.5" />
      <path d="M7 6h6M7 10h4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

function OffersIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 20 20" fill="none">
      <path d="M10 2l2.5 5 5.5.8-4 3.9.9 5.3L10 14.5 5.1 17l.9-5.3-4-3.9 5.5-.8L10 2z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
    </svg>
  );
}

function CampaignIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 20 20" fill="none">
      <path d="M3 10l4-6v12l-4-6zM7 5l9-2v14l-9-2V5z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
      <path d="M16 8.5a2.5 2.5 0 010 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

function MediaIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 20 20" fill="none">
      <rect x="2" y="3" width="16" height="14" rx="2" stroke="currentColor" strokeWidth="1.5" />
      <circle cx="7" cy="8" r="2" stroke="currentColor" strokeWidth="1.5" />
      <path d="M2 14l4-4 3 3 4-5 5 6" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
    </svg>
  );
}

function UsersIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 20 20" fill="none">
      <circle cx="10" cy="7" r="3.5" stroke="currentColor" strokeWidth="1.5" />
      <path d="M3 18c0-3.3 3.1-6 7-6s7 2.7 7 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

function BellIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 20 20" fill="none">
      <path d="M10 2a5 5 0 00-5 5v3l-1.5 2.5h13L15 10V7a5 5 0 00-5-5z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
      <path d="M8 15a2 2 0 004 0" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

function RulesIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 20 20" fill="none">
      <path d="M10 2v16M6 6l8 0M6 10h8M6 14h8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <path d="M3 2h14M3 18h14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

function AuditIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 20 20" fill="none">
      <rect x="3" y="2" width="14" height="16" rx="2" stroke="currentColor" strokeWidth="1.5" />
      <path d="M7 6h6M7 9.5h6M7 13h3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <circle cx="14" cy="14" r="3" stroke="currentColor" strokeWidth="1.5" />
      <path d="M16.1 16.1L18 18" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

function SettingsIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 20 20" fill="none">
      <circle cx="10" cy="10" r="3" stroke="currentColor" strokeWidth="1.5" />
      <path d="M10 2v2M10 16v2M2 10h2M16 10h2M4.93 4.93l1.41 1.41M13.66 13.66l1.41 1.41M4.93 15.07l1.41-1.41M13.66 6.34l1.41-1.41" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

function CategoriesIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 20 20" fill="none">
      <path d="M2 4a2 2 0 012-2h4l2 2h6a2 2 0 012 2v10a2 2 0 01-2 2H4a2 2 0 01-2-2V4z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
      <path d="M7 10h6M7 13h4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

function AnalyticsIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 20 20" fill="none">
      <rect x="2" y="2" width="16" height="16" rx="2" stroke="currentColor" strokeWidth="1.5" />
      <path d="M6 14V10M10 14V6M14 14V8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

function AbTestIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 20 20" fill="none">
      <path d="M10 2v6M10 8l-5 5M10 8l5 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="5" cy="15" r="2.5" stroke="currentColor" strokeWidth="1.5" />
      <circle cx="15" cy="15" r="2.5" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  );
}

function ExportsIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 20 20" fill="none">
      <path d="M4 13v3a2 2 0 002 2h8a2 2 0 002-2v-3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <path d="M10 3v10M7 6l3-3 3 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function AiIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 20 20" fill="none">
      <path d="M10 2l1.5 4.5L16 8l-4.5 1.5L10 14l-1.5-4.5L4 8l4.5-1.5L10 2z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
      <path d="M15 13l.75 2.25L18 16l-2.25.75L15 19l-.75-2.25L12 16l2.25-.75L15 13z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" />
    </svg>
  );
}

function LogoutIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 20 20" fill="none">
      <path d="M7 3H4a1 1 0 00-1 1v12a1 1 0 001 1h3M13 14l4-4-4-4M17 10H8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/**
 * Chaque entree porte les permissions exigees par les endpoints qu'elle consomme.
 * `anyOf` : au moins une des permissions suffit. Une entree sans `anyOf` est
 * ouverte a tous les comptes authentifies (le backend ne la protege pas non plus).
 * Les codes sont ceux renvoyes par le backend dans `user.permissions`.
 */
const NAV_ITEMS: { href: string; key: string; icon: (p: { className?: string }) => React.ReactElement; anyOf?: string[] }[] = [
  { href: "/", key: "dashboard", icon: DashboardIcon },
  { href: "/catalog", key: "catalog", icon: CatalogIcon, anyOf: ["CATALOG_READ"] },
  { href: "/categories", key: "categories", icon: CategoriesIcon, anyOf: ["CATALOG_READ"] },
  { href: "/offers", key: "offers", icon: OffersIcon, anyOf: ["CATALOG_READ"] },
  { href: "/campaigns", key: "campaigns", icon: CampaignIcon, anyOf: ["CAMPAIGN_MANAGE"] },
  { href: "/media", key: "media", icon: MediaIcon, anyOf: ["MEDIA_UPLOAD", "MEDIA_VALIDATE"] },
  { href: "/ab-tests", key: "abTests", icon: AbTestIcon, anyOf: ["CATALOG_READ"] },
  { href: "/rules", key: "rules", icon: RulesIcon, anyOf: ["RULE_MANAGE"] },
  { href: "/users", key: "users", icon: UsersIcon, anyOf: ["USER_MANAGE"] },
  { href: "/notifications", key: "notifications", icon: BellIcon },
  { href: "/analytics", key: "analytics", icon: AnalyticsIcon, anyOf: ["ANALYTICS_VIEW"] },
  { href: "/exports", key: "exports", icon: ExportsIcon, anyOf: ["EXPORT_MANAGE"] },
  { href: "/ai", key: "ai", icon: AiIcon, anyOf: ["CATALOG_READ"] },
  { href: "/audit", key: "audit", icon: AuditIcon, anyOf: ["AUDIT_VIEW"] },
  { href: "/settings", key: "settings", icon: SettingsIcon, anyOf: ["CONFIG_MANAGE"] },
];

export default function Sidebar({ open, onClose }: { open: boolean; onClose: () => void }) {
  const pathname = usePathname();
  const { user, logout } = useAuth();
  const t = useTranslations("sidebar");
  const tu = useTranslations("users.roles");

  // Le menu ne propose que les pages reellement accessibles : sans ce filtre,
  // un role non administrateur atterrissait sur des ecrans en erreur 403.
  const granted = new Set(user?.permissions ?? []);
  const navItems = NAV_ITEMS.filter(
    (item) => !item.anyOf || item.anyOf.some((code) => granted.has(code))
  );

  // Nombre de notifications non lues, affiche sur l'icone du menu.
  // Sans lui, il fallait ouvrir l'ecran Notifications pour savoir s'il y avait
  // quelque chose a traiter, ce qui rendait le circuit de validation aveugle.
  const [unreadCount, setUnreadCount] = useState(0);

  const refreshUnread = useCallback(async () => {
    if (!user) return;
    try {
      const { data } = await api.get("/notifications/unread/count");
      setUnreadCount(typeof data === "number" ? data : data.count ?? 0);
    } catch {
      // Compteur indisponible : on n'affiche rien plutot qu'un chiffre faux.
      setUnreadCount(0);
    }
  }, [user]);

  useEffect(() => {
    refreshUnread();
    // Relecture reguliere : une notification peut naitre d'une action d'un autre
    // acteur, sans que cet onglet ait navigue.
    const timer = setInterval(refreshUnread, 30000);
    // L'ecran Notifications previent des qu'une notification est marquee lue,
    // pour que la pastille ne reste pas en retard le temps du prochain cycle.
    window.addEventListener(NOTIFICATIONS_UPDATED_EVENT, refreshUnread);
    return () => {
      clearInterval(timer);
      window.removeEventListener(NOTIFICATIONS_UPDATED_EVENT, refreshUnread);
    };
  }, [refreshUnread]);

  // Le passage sur un autre ecran peut avoir change le compte.
  useEffect(() => { refreshUnread(); }, [pathname, refreshUnread]);

  useEffect(() => {
    function handleEscape(e: KeyboardEvent) {
      if (e.key === "Escape" && open) onClose();
    }
    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [open, onClose]);

  return (
    <>
      {/* Backdrop mobile */}
      {open && (
        <div
          className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm lg:hidden"
          onClick={onClose}
        />
      )}

      <aside className={`fixed left-0 top-0 z-50 flex h-dvh w-[260px] flex-col border-r border-border dark:border-neutral-800 bg-white dark:bg-neutral-900 transition-transform duration-200 ${open ? "translate-x-0" : "-translate-x-full"} lg:translate-x-0`}>
        {/* ===== EN-TÊTE — Logo ===== */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border dark:border-neutral-800">
          <div className="flex items-center gap-3">
            <Image
              src="/img/logo-light.jpeg"
              alt="Moov Africa"
              width={100}
              height={28}
              className="h-7 w-auto dark:hidden"
            />
            <Image
              src="/img/logo-dark.jpeg"
              alt="Moov Africa"
              width={100}
              height={28}
              className="h-7 w-auto hidden dark:block"
            />
          </div>
          <button
            onClick={onClose}
            className="lg:hidden size-8 rounded-lg flex items-center justify-center hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors cursor-pointer"
          >
            <svg className="size-4 text-neutral-600 dark:text-neutral-400" viewBox="0 0 16 16" fill="none">
              <path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          </button>
        </div>

        {/* ===== NAVIGATION ===== */}
        <nav className="flex-1 overflow-y-auto hide-scrollbar px-3 py-3">
          <ul className="flex flex-col gap-0.5">
            {navItems.map((item) => {
              const active =
                item.href === "/"
                  ? pathname === "/"
                  : pathname.startsWith(item.href);
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    onClick={onClose}
                    className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-all duration-150 ${
                      active
                        ? "bg-primary/10 text-primary dark:bg-primary/20 dark:text-primary-light"
                        : "text-neutral-600 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-800"
                    }`}
                  >
                    <item.icon className="size-[18px] shrink-0" />
                    <span className="flex-1 truncate">{t(item.key)}</span>
                    {item.key === "notifications" && unreadCount > 0 && (
                      <span className="shrink-0 min-w-5 h-5 px-1.5 flex items-center justify-center rounded-full bg-primary text-white text-[10px] font-bold tabular-nums">
                        {unreadCount > 99 ? "99+" : unreadCount}
                      </span>
                    )}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>

        {/* ===== BAS — Profil + actions ===== */}
        {user && (
          <div className="border-t border-border dark:border-neutral-800 px-3 py-3 flex flex-col gap-2">
            {/* Langue */}
            <LanguageSwitcher />

            {/* Toggle thème */}
            <div className="flex items-center justify-between px-3 py-1">
              <span className="text-xs text-neutral-500 dark:text-neutral-400">{t("theme")}</span>
              <ThemeToggle />
            </div>

            {/* Infos utilisateur */}
            <Link
              href="/profile"
              onClick={onClose}
              className="flex items-center gap-3 px-3 py-2 rounded-lg bg-neutral-50 dark:bg-neutral-800 hover:bg-neutral-100 dark:hover:bg-neutral-700 transition-colors"
            >
              <div className="flex items-center justify-center size-8 rounded-full bg-primary text-white text-xs font-bold shrink-0">
                {user.firstName?.[0]}{user.lastName?.[0]}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-secondary dark:text-white truncate">
                  {user.firstName} {user.lastName}
                </p>
                <p className="text-xs text-neutral-500 dark:text-neutral-400 truncate">
                  {tu.has(user.role) ? tu(user.role) : user.role}
                </p>
              </div>
            </Link>

            {/* Bouton déconnexion */}
            <button
              onClick={logout}
              className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
            >
              <LogoutIcon className="size-4" />
              {t("logout")}
            </button>
          </div>
        )}
      </aside>
    </>
  );
}
