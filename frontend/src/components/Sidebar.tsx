"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { useAuth } from "@/lib/auth";
import { ROLE_LABELS } from "@/lib/types";
import ThemeToggle from "@/components/ThemeToggle";

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

function LogoutIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 20 20" fill="none">
      <path d="M7 3H4a1 1 0 00-1 1v12a1 1 0 001 1h3M13 14l4-4-4-4M17 10H8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

const NAV_ITEMS = [
  { href: "/", label: "Tableau de bord", icon: DashboardIcon },
  { href: "/catalog", label: "Catalogue", icon: CatalogIcon },
  { href: "/offers", label: "Offres", icon: OffersIcon },
  { href: "/campaigns", label: "Campagnes", icon: CampaignIcon },
  { href: "/media", label: "Médias", icon: MediaIcon },
  { href: "/users", label: "Utilisateurs", icon: UsersIcon },
  { href: "/notifications", label: "Notifications", icon: BellIcon },
];

export default function Sidebar() {
  const pathname = usePathname();
  const { user, logout } = useAuth();

  return (
    <aside className="fixed left-0 top-0 z-40 flex h-dvh w-[260px] flex-col border-r border-border dark:border-neutral-800 bg-white dark:bg-neutral-900">
      {/* ===== EN-TÊTE — Logo ===== */}
      <div className="flex items-center gap-3 px-5 py-4 border-b border-border dark:border-neutral-800">
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

      {/* ===== NAVIGATION ===== */}
      <nav className="flex-1 overflow-y-auto hide-scrollbar px-3 py-3">
        <ul className="flex flex-col gap-0.5">
          {NAV_ITEMS.map((item) => {
            const active =
              item.href === "/"
                ? pathname === "/"
                : pathname.startsWith(item.href);
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-all duration-150 ${
                    active
                      ? "bg-primary/10 text-primary dark:bg-primary/20 dark:text-primary-light"
                      : "text-neutral-600 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-800"
                  }`}
                >
                  <item.icon className="size-[18px] shrink-0" />
                  {item.label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      {/* ===== BAS — Profil + actions ===== */}
      {user && (
        <div className="border-t border-border dark:border-neutral-800 px-3 py-3 flex flex-col gap-2">
          {/* Toggle thème */}
          <div className="flex items-center justify-between px-3 py-1">
            <span className="text-xs text-neutral-500 dark:text-neutral-400">Thème</span>
            <ThemeToggle />
          </div>

          {/* Infos utilisateur */}
          <div className="flex items-center gap-3 px-3 py-2 rounded-lg bg-neutral-50 dark:bg-neutral-800">
            <div className="flex items-center justify-center size-8 rounded-full bg-primary text-white text-xs font-bold shrink-0">
              {user.firstName?.[0]}{user.lastName?.[0]}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-secondary dark:text-white truncate">
                {user.firstName} {user.lastName}
              </p>
              <p className="text-xs text-neutral-500 dark:text-neutral-400 truncate">
                {ROLE_LABELS[user.role] || user.role}
              </p>
            </div>
          </div>

          {/* Bouton déconnexion */}
          <button
            onClick={logout}
            className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
          >
            <LogoutIcon className="size-4" />
            Déconnexion
          </button>
        </div>
      )}
    </aside>
  );
}
