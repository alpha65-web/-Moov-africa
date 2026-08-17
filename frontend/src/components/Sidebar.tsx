"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/lib/auth";
import { ROLE_LABELS } from "@/lib/types";
import {
  LayoutDashboard,
  Package,
  Tag,
  Megaphone,
  Image,
  Users,
  Bell,
  LogOut,
} from "lucide-react";

const NAV_ITEMS = [
  { href: "/", label: "Tableau de bord", icon: LayoutDashboard },
  { href: "/catalog", label: "Catalogue", icon: Package },
  { href: "/offers", label: "Offres", icon: Tag },
  { href: "/campaigns", label: "Campagnes", icon: Megaphone },
  { href: "/media", label: "Medias", icon: Image },
  { href: "/users", label: "Utilisateurs", icon: Users },
  { href: "/notifications", label: "Notifications", icon: Bell },
];

export default function Sidebar() {
  const pathname = usePathname();
  const { user, logout } = useAuth();

  return (
    <aside className="fixed left-0 top-0 z-40 flex h-screen w-64 flex-col border-r border-border bg-white dark:border-neutral-700 dark:bg-neutral-900">
      <div className="flex h-16 items-center gap-3 border-b border-border px-6 dark:border-neutral-700">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary font-bold text-white text-sm">
          M
        </div>
        <div>
          <p className="text-sm font-semibold text-gray-900 dark:text-white">
            PIM Moov Africa
          </p>
          <p className="text-xs text-gray-500">Burkina Faso</p>
        </div>
      </div>

      <nav className="flex-1 overflow-y-auto px-3 py-4">
        <ul className="space-y-1">
          {NAV_ITEMS.map((item) => {
            const active =
              item.href === "/"
                ? pathname === "/"
                : pathname.startsWith(item.href);
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
                    active
                      ? "bg-primary/10 text-primary dark:bg-primary/20 dark:text-primary-light"
                      : "text-secondary dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800"
                  }`}
                >
                  <item.icon className="h-5 w-5 shrink-0" />
                  {item.label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      {user && (
        <div className="border-t border-border p-4 dark:border-neutral-700">
          <div className="mb-3">
            <p className="text-sm font-medium text-gray-900 dark:text-white">
              {user.firstName} {user.lastName}
            </p>
            <p className="text-xs text-gray-500">
              {ROLE_LABELS[user.role] || user.role}
            </p>
          </div>
          <button
            onClick={logout}
            className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-900/20"
          >
            <LogOut className="h-4 w-4" />
            Deconnexion
          </button>
        </div>
      )}
    </aside>
  );
}
