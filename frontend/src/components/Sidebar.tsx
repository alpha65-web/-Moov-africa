"use client";

import { useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { useAuth } from "@/lib/auth";
import { useUnreadCount } from "@/lib/notifications";
import ThemeToggle from "@/components/ThemeToggle";
import LanguageSwitcher from "@/components/LanguageSwitcher";
import Avatar from "@/components/Avatar";
import { useTranslations } from "next-intl";
import {
  AbTestIcon, AiIcon, AnalyticsIcon, AuditIcon, BellIcon, CampaignIcon, CatalogIcon,
  CategoriesIcon, DashboardIcon, ExportsIcon, LogoutIcon, MediaIcon, OffersIcon,
  RulesIcon, SettingsIcon, UsersIcon,
} from "@/components/NavIcons";

/**
 * Sections du menu. Elles regroupent les ecrans par metier pour qu'un role qui
 * n'en voit que trois ou quatre les trouve tout de suite, et pour que
 * l'administrateur, qui les voit tous, ne lise pas une colonne de quinze entrees
 * indifferenciees.
 */
type Section = "navigation" | "content" | "steering" | "administration";
const SECTION_ORDER: Section[] = ["navigation", "content", "steering", "administration"];

/**
 * Chaque entree porte les permissions exigees par les endpoints qu'elle consomme.
 * `anyOf` : au moins une des permissions suffit. Une entree sans `anyOf` est
 * ouverte a tous les comptes authentifies (le backend ne la protege pas non plus).
 * Les codes sont ceux renvoyes par le backend dans `user.permissions`.
 */
const NAV_ITEMS: {
  href: string; key: string; section: Section;
  icon: (p: { className?: string }) => React.ReactElement; anyOf?: string[];
}[] = [
  { href: "/", key: "dashboard", section: "navigation", icon: DashboardIcon },

  // Seul ecran reellement commun : chaque role y voit sa propre etape du circuit.
  { href: "/offers", key: "offers", section: "navigation", icon: OffersIcon, anyOf: ["CATALOG_READ"] },

  // Le catalogue sert de contexte a tous ceux qui interviennent sur une fiche,
  // mais pas au community manager, qui ne consulte que des offres publiees.
  // CATALOG_READ ne pouvait pas servir de filtre : tous les roles la detiennent.
  { href: "/catalog", key: "catalog", section: "navigation", icon: CatalogIcon,
    anyOf: ["CATALOG_MANAGE", "OFFER_ENRICH", "OFFER_VALIDATE", "OFFER_PUBLISH"] },

  // Classer les briques releve de celui qui les cree.
  { href: "/categories", key: "categories", section: "navigation", icon: CategoriesIcon, anyOf: ["CATALOG_MANAGE"] },
  { href: "/rules", key: "rules", section: "navigation", icon: RulesIcon, anyOf: ["RULE_MANAGE"] },

  { href: "/media", key: "media", section: "content", icon: MediaIcon, anyOf: ["MEDIA_UPLOAD", "MEDIA_VALIDATE"] },
  { href: "/campaigns", key: "campaigns", section: "content", icon: CampaignIcon, anyOf: ["CAMPAIGN_MANAGE"] },

  // Les tests A/B relevent de l'analyste marketing (cahier des charges, l. 104).
  // La permission d'ecriture est le bon filtre : un ecran de tests que l'on ne
  // peut ni creer ni lancer n'a pas d'utilite.
  { href: "/ab-tests", key: "abTests", section: "content", icon: AbTestIcon, anyOf: ["CATALOG_WRITE"] },

  // Les deux fonctions d'IA sont attribuees : auto-tagging au chef de produit a la
  // creation, generation de contenu a l'analyste pendant l'enrichissement
  // (section 7.10). Les valideurs et le community manager n'en ont pas l'usage.
  { href: "/ai", key: "ai", section: "content", icon: AiIcon, anyOf: ["CATALOG_MANAGE", "OFFER_ENRICH"] },

  { href: "/analytics", key: "analytics", section: "steering", icon: AnalyticsIcon, anyOf: ["ANALYTICS_VIEW"] },
  { href: "/notifications", key: "notifications", section: "steering", icon: BellIcon },
  { href: "/exports", key: "exports", section: "steering", icon: ExportsIcon, anyOf: ["EXPORT_MANAGE"] },
  { href: "/audit", key: "audit", section: "steering", icon: AuditIcon, anyOf: ["AUDIT_VIEW"] },

  { href: "/users", key: "users", section: "administration", icon: UsersIcon, anyOf: ["USER_MANAGE"] },
  { href: "/settings", key: "settings", section: "administration", icon: SettingsIcon, anyOf: ["CONFIG_MANAGE"] },
];

export default function Sidebar({ open, onClose }: { open: boolean; onClose: () => void }) {
  const pathname = usePathname();
  const { user, logout } = useAuth();
  const t = useTranslations("sidebar");
  const tu = useTranslations("users.roles");
  const { count: unreadCount } = useUnreadCount();

  // Le menu ne propose que les pages reellement accessibles : sans ce filtre,
  // un role non administrateur atterrissait sur des ecrans en erreur 403.
  const granted = new Set(user?.permissions ?? []);
  const navItems = NAV_ITEMS.filter(
    (item) => !item.anyOf || item.anyOf.some((code) => granted.has(code))
  );
  const sections = SECTION_ORDER
    .map((section) => ({ section, items: navItems.filter((item) => item.section === section) }))
    .filter((group) => group.items.length > 0);

  useEffect(() => {
    function handleEscape(e: KeyboardEvent) {
      if (e.key === "Escape" && open) onClose();
    }
    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [open, onClose]);

  return (
    <>
      {/* Voile mobile */}
      {open && (
        <div
          className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm lg:hidden"
          onClick={onClose}
        />
      )}

      {/* Bleu Moov de haut en bas : la barre garde la meme identite en mode clair
          et en mode sombre, comme le logo. */}
      <aside className={`fixed left-0 top-0 z-50 flex h-dvh w-[260px] flex-col rounded-r-2xl bg-gradient-to-b from-brand-dark to-brand text-white shadow-xl shadow-black/10 transition-transform duration-200 ${open ? "translate-x-0" : "-translate-x-full"} lg:translate-x-0`}>
        {/* ===== EN-TETE : logo et nom du produit ===== */}
        <div className="px-4 pt-4 pb-3">
          <div className="flex items-start justify-between gap-2">
            <Link href="/" onClick={onClose} className="block rounded-xl overflow-hidden ring-1 ring-white/20 shadow-lg shadow-black/10">
              <Image
                src="/img/logo-dark.jpeg"
                alt="Moov Africa"
                width={200}
                height={112}
                className="h-16 w-auto"
                priority
              />
            </Link>
            <button
              onClick={onClose}
              aria-label={t("close")}
              className="lg:hidden size-8 rounded-lg flex items-center justify-center text-white/80 hover:bg-white/10 transition-colors cursor-pointer"
            >
              <svg className="size-4" viewBox="0 0 16 16" fill="none">
                <path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
            </button>
          </div>
          <p className="mt-3 text-[10px] font-semibold uppercase tracking-[0.18em] text-white/60">{t("productName")}</p>
        </div>

        {/* ===== COMPTE CONNECTE ===== */}
        {user && (
          <Link
            href="/profile"
            onClick={onClose}
            className="mx-3 mb-2 flex items-center gap-3 rounded-xl bg-white/10 px-3 py-2.5 hover:bg-white/15 transition-colors"
          >
            <span className="rounded-full ring-2 ring-white/20 shrink-0">
              <Avatar firstName={user.firstName} lastName={user.lastName} avatarUrl={user.avatarUrl} className="size-9" />
            </span>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-white truncate">{user.firstName} {user.lastName}</p>
              <p className="text-[11px] font-medium text-orange-200 truncate">
                {tu.has(user.role) ? tu(user.role) : user.role}
              </p>
            </div>
          </Link>
        )}

        {/* ===== NAVIGATION PAR SECTIONS ===== */}
        <nav className="flex-1 overflow-y-auto hide-scrollbar px-3 pb-2">
          {sections.map((group) => (
            <div key={group.section} className="mt-3 first:mt-1">
              <p className="px-3 pb-1.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-white/50">
                {t(`sections.${group.section}`)}
              </p>
              <ul className="flex flex-col gap-0.5">
                {group.items.map((item) => {
                  const active = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
                  return (
                    <li key={item.href}>
                      <Link
                        href={item.href}
                        onClick={onClose}
                        className={`relative flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors duration-150 ${
                          active
                            ? "bg-white/15 text-white font-semibold"
                            : "text-white/80 hover:bg-white/10 hover:text-white"
                        }`}
                      >
                        {/* Repere orange de la page courante, dans la couleur d'accent du logo. */}
                        {active && <span className="absolute left-0 top-1.5 bottom-1.5 w-1 rounded-r bg-primary" aria-hidden="true" />}
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
            </div>
          ))}
        </nav>

        {/* ===== BAS : langue, theme, deconnexion ===== */}
        {user && (
          <div className="border-t border-white/10 px-3 py-3 flex flex-col gap-1">
            <div className="flex items-center gap-2">
              <div className="flex-1 min-w-0">
                <LanguageSwitcher />
              </div>
              <ThemeToggle />
            </div>
            <button
              onClick={logout}
              className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-white/80 hover:bg-white/10 hover:text-white transition-colors cursor-pointer"
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
