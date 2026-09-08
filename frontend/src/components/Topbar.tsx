"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import { useAuth } from "@/lib/auth";
import { useUnreadCount } from "@/lib/notifications";
import { BellIcon } from "@/components/NavIcons";
import Avatar from "@/components/Avatar";

/** Cle de traduction (sidebar.*) de l'ecran designe par le premier segment de l'URL. */
const PAGE_KEYS: Record<string, string> = {
  "": "dashboard", offers: "offers", catalog: "catalog", categories: "categories", rules: "rules",
  media: "media", campaigns: "campaigns", "ab-tests": "abTests", ai: "ai", analytics: "analytics",
  notifications: "notifications", exports: "exports", audit: "audit", users: "users",
  settings: "settings", profile: "profile",
};

/**
 * Barre superieure des ecrans connectes (grand ecran seulement ; le mobile garde
 * sa barre avec le bouton de menu).
 *
 * Elle porte trois informations vraies et rien d'autre : l'ecran courant,
 * l'etat de la liaison avec le serveur — deduit du dernier appel reellement
 * emis, pas d'une constante — et le nombre de notifications non lues.
 */
export default function Topbar() {
  const pathname = usePathname();
  const { user } = useAuth();
  const t = useTranslations("sidebar");
  const tt = useTranslations("topbar");
  const tu = useTranslations("users.roles");
  const { count: unreadCount, online } = useUnreadCount();

  const segment = pathname.split("/")[1] ?? "";
  const pageKey = PAGE_KEYS[segment];

  return (
    <header className="hidden lg:flex fixed top-0 left-[260px] right-0 z-30 h-14 items-center justify-between gap-4 px-6 border-b border-border dark:border-neutral-800 bg-white dark:bg-neutral-900">
      {/* Ecran courant */}
      <div className="flex items-center gap-2 min-w-0">
        <span className="text-sm font-semibold text-brand dark:text-white truncate">{tt("appName")}</span>
        {pageKey && (
          <>
            <span className="text-neutral-300 dark:text-neutral-600" aria-hidden="true">/</span>
            <span className="text-sm text-text-secondary dark:text-neutral-400 truncate">{t(pageKey)}</span>
          </>
        )}
      </div>

      <div className="flex items-center gap-3 shrink-0">
        {/* Etat de la liaison : vert quand le dernier appel a repondu, rouge sinon. */}
        <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-medium ${
          online === true
            ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-900/25 dark:text-emerald-400"
            : online === false
              ? "bg-red-50 text-red-700 dark:bg-red-900/25 dark:text-red-400"
              : "bg-neutral-100 text-neutral-500 dark:bg-neutral-800 dark:text-neutral-400"
        }`}>
          <span className={`size-1.5 rounded-full ${online === true ? "bg-emerald-500" : online === false ? "bg-red-500" : "bg-neutral-400"}`} aria-hidden="true" />
          {online === true ? tt("online") : online === false ? tt("offline") : tt("checking")}
        </span>

        {/* Notifications */}
        <Link
          href="/notifications"
          aria-label={t("notifications")}
          className="relative size-9 rounded-full border border-border dark:border-neutral-700 flex items-center justify-center text-neutral-600 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
        >
          <BellIcon className="size-[18px]" />
          {unreadCount > 0 && (
            <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 flex items-center justify-center rounded-full bg-primary text-white text-[10px] font-bold tabular-nums ring-2 ring-white dark:ring-neutral-900">
              {unreadCount > 99 ? "99+" : unreadCount}
            </span>
          )}
        </Link>

        {/* Compte connecte */}
        {user && (
          <Link
            href="/profile"
            className="flex items-center gap-2.5 rounded-full border border-border dark:border-neutral-700 pl-1 pr-3 py-1 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
          >
            <Avatar firstName={user.firstName} lastName={user.lastName} avatarUrl={user.avatarUrl} className="size-7" textClass="text-[11px]" />
            <span className="flex flex-col leading-tight">
              <span className="text-xs font-semibold text-black dark:text-white">{user.firstName} {user.lastName}</span>
              <span className="text-[10px] text-text-secondary dark:text-neutral-400">{tu.has(user.role) ? tu(user.role) : user.role}</span>
            </span>
          </Link>
        )}
      </div>
    </header>
  );
}
