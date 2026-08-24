"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import api, { apiError } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { searchKeyHandler } from "@/lib/search";
import { notifyNotificationsUpdated } from "@/lib/notifications";
import type { Notification } from "@/lib/types";
import toast from "react-hot-toast";
import { useTranslations } from "next-intl";

/**
 * Les cles reprennent exactement l'enum NotificationType du backend
 * (ENRICHMENT_REQUIRED, VALIDATION_REQUIRED, STRATEGIC_VALIDATION, OFFER_REJECTED,
 * OFFER_PUBLISHED, OFFER_EXPIRING, CAMPAIGN_READY). Toute autre cle serait morte.
 */
const TYPE_STYLES: Record<string, { badge: string; icon: string }> = {
  ENRICHMENT_REQUIRED: {
    badge: "bg-sky-50 text-sky-700 dark:bg-sky-900/30 dark:text-sky-400",
    icon: "text-sky-600 dark:text-sky-400 bg-sky-100 dark:bg-sky-900/30",
  },
  VALIDATION_REQUIRED: {
    badge: "bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
    icon: "text-blue-600 dark:text-blue-400 bg-blue-100 dark:bg-blue-900/30",
  },
  STRATEGIC_VALIDATION: {
    badge: "bg-indigo-50 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400",
    icon: "text-indigo-600 dark:text-indigo-400 bg-indigo-100 dark:bg-indigo-900/30",
  },
  OFFER_REJECTED: {
    badge: "bg-red-50 text-red-700 dark:bg-red-900/30 dark:text-red-400",
    icon: "text-red-600 dark:text-red-400 bg-red-100 dark:bg-red-900/30",
  },
  OFFER_PUBLISHED: {
    badge: "bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400",
    icon: "text-emerald-600 dark:text-emerald-400 bg-emerald-100 dark:bg-emerald-900/30",
  },
  OFFER_EXPIRING: {
    badge: "bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
    icon: "text-amber-600 dark:text-amber-400 bg-amber-100 dark:bg-amber-900/30",
  },
  CAMPAIGN_READY: {
    badge: "bg-teal-50 text-teal-700 dark:bg-teal-900/30 dark:text-teal-400",
    icon: "text-teal-600 dark:text-teal-400 bg-teal-100 dark:bg-teal-900/30",
  },
};

const TYPE_ICONS: Record<string, React.ReactNode> = {
  ENRICHMENT_REQUIRED: (
    <svg className="size-5" viewBox="0 0 20 20" fill="none"><path d="M10 2v4M10 14v4M2 10h4M14 10h4" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" /><circle cx="10" cy="10" r="3" stroke="currentColor" strokeWidth="1.3" /></svg>
  ),
  VALIDATION_REQUIRED: (
    <svg className="size-5" viewBox="0 0 20 20" fill="none"><rect x="3" y="2" width="14" height="16" rx="2" stroke="currentColor" strokeWidth="1.3" /><path d="M7 8h6M7 11h4" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" /><path d="M12.5 14l1 1 2-2" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" /></svg>
  ),
  STRATEGIC_VALIDATION: (
    <svg className="size-5" viewBox="0 0 20 20" fill="none"><path d="M10 2l6 3v5c0 3.5-2.5 6.5-6 8-3.5-1.5-6-4.5-6-8V5l6-3z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" /><path d="M7.5 10l2 2 3.5-3.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" /></svg>
  ),
  OFFER_REJECTED: (
    <svg className="size-5" viewBox="0 0 20 20" fill="none"><circle cx="10" cy="10" r="7.5" stroke="currentColor" strokeWidth="1.3" /><path d="M7.5 7.5l5 5M12.5 7.5l-5 5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" /></svg>
  ),
  OFFER_PUBLISHED: (
    <svg className="size-5" viewBox="0 0 20 20" fill="none"><circle cx="10" cy="10" r="7.5" stroke="currentColor" strokeWidth="1.3" /><path d="M7 10l2 2 4-4" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" /></svg>
  ),
  OFFER_EXPIRING: (
    <svg className="size-5" viewBox="0 0 20 20" fill="none"><circle cx="10" cy="10" r="7.5" stroke="currentColor" strokeWidth="1.3" /><path d="M10 6v4.5l3 1.8" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" /></svg>
  ),
  CAMPAIGN_READY: (
    <svg className="size-5" viewBox="0 0 20 20" fill="none"><path d="M3 10l4-6v12l-4-6zM7 5l9-2v14l-9-2V5z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" /></svg>
  ),
};

const PER_PAGE = 5;

function Skeleton({ className }: { className: string }) {
  return <div className={`rounded-lg bg-neutral-100 dark:bg-neutral-800 animate-pulse ${className}`} />;
}

export default function NotificationsPage() {
  const t = useTranslations("notifications");
  const tc = useTranslations("common");
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [unreadCount, setUnreadCount] = useState(0);
  const [filter, setFilter] = useState<"all" | "unread" | "read">("all");
  const { user } = useAuth();
  const canManageConfig = (user?.permissions ?? []).includes("CONFIG_MANAGE");
  const [search, setSearch] = useState("");
  const [filterType, setFilterType] = useState("");
  const [sortOrder, setSortOrder] = useState<"recent" | "oldest">("recent");
  const [page, setPage] = useState(1);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);

  useEffect(() => { loadNotifications(); loadUnreadCount(); }, []);

  useEffect(() => {
    function handleClickOutside() { if (openMenuId) setOpenMenuId(null); }
    document.addEventListener("click", handleClickOutside);
    return () => document.removeEventListener("click", handleClickOutside);
  }, [openMenuId]);

  useEffect(() => { setPage(1); }, [filter, search, filterType]);

  async function loadNotifications() {
    try { const { data } = await api.get("/notifications", { params: { size: 500 } }); setNotifications(data.content ?? data); }
    catch (e) { toast.error(apiError(e, tc("errors.load"))); }
    finally { setLoading(false); }
  }

  async function loadUnreadCount() {
    try {
      const { data } = await api.get("/notifications/unread/count");
      setUnreadCount(typeof data === "number" ? data : data.count ?? 0);
      notifyNotificationsUpdated();
    }
    catch { /* */ }
  }

  async function markAsRead(id: string) {
    try { await api.patch(`/notifications/${id}/read`); loadNotifications(); loadUnreadCount(); }
    catch (e) { toast.error(apiError(e, tc("errors.action"))); }
  }

  async function markAllAsRead() {
    try { await api.patch("/notifications/read-all"); toast.success(t("allMarkedRead")); loadNotifications(); loadUnreadCount(); }
    catch (e) { toast.error(apiError(e, tc("errors.action"))); }
  }

  function formatDate(dateStr: string): string {
    const d = new Date(dateStr);
    return d.toLocaleDateString(undefined, { day: "2-digit", month: "2-digit", year: "numeric" }) + " " + d.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
  }


  const allTypes = [...new Set(notifications.map((n) => n.type))];

  const filtered = notifications.filter((n) => {
    if (filter === "unread" && n.read) return false;
    if (filter === "read" && !n.read) return false;
    if (search && !`${n.title} ${n.message}`.toLowerCase().includes(search.toLowerCase())) return false;
    if (filterType && n.type !== filterType) return false;
    return true;
  });

  const sorted = [...filtered].sort((a, b) => {
    const da = new Date(a.createdAt).getTime();
    const db = new Date(b.createdAt).getTime();
    return sortOrder === "recent" ? db - da : da - db;
  });

  const totalPages = Math.max(1, Math.ceil(sorted.length / PER_PAGE));
  const paginated = sorted.slice((page - 1) * PER_PAGE, page * PER_PAGE);
  const readCount = notifications.length - unreadCount;

  const tabFilters = [
    { key: "all" as const, label: t("filter.all"), count: notifications.length, icon: (
      <svg className="size-4" viewBox="0 0 16 16" fill="none"><rect x="2" y="3" width="12" height="10" rx="2" stroke="currentColor" strokeWidth="1.2" /><path d="M2 6l7 4 7-4" stroke="currentColor" strokeWidth="1.2" /></svg>
    ) },
    { key: "unread" as const, label: t("filter.unread"), count: unreadCount, icon: (
      <svg className="size-4" viewBox="0 0 16 16" fill="none"><circle cx="8" cy="8" r="3" fill="currentColor" /><circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="1.2" /></svg>
    ) },
    { key: "read" as const, label: t("filter.read"), count: readCount, icon: (
      <svg className="size-4" viewBox="0 0 16 16" fill="none"><circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="1.2" /><path d="M5.5 8l2 2 3.5-3.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" /></svg>
    ) },
  ];

  return (
    <div className="flex flex-col gap-6 pb-8">

      {/* ===== HEADER ===== */}
      <div>
        <h1 className="text-2xl font-bold text-black dark:text-white">{t("title")}</h1>
        <p className="text-sm text-text-secondary dark:text-neutral-500 mt-1">{t("subtitle")}</p>
      </div>

      {/* ===== TABS + PARAMÈTRES ===== */}
      <div className="flex items-center justify-between">
        <div className="flex gap-1 p-1 rounded-xl bg-neutral-100 dark:bg-neutral-800/50 border border-border dark:border-neutral-800 w-fit">
          {tabFilters.map((tab) => (
            <button key={tab.key} onClick={() => setFilter(tab.key)} className={`flex items-center gap-2 px-4 py-2 text-sm font-medium transition-all cursor-pointer ${filter === tab.key ? "bg-white dark:bg-neutral-700 text-black dark:text-white shadow-sm" : "text-text-secondary dark:text-neutral-400 hover:text-black dark:hover:text-white"}`} style={{ borderRadius: 8 }}>
              <span className={filter === tab.key ? "text-primary" : ""}>{tab.icon}</span>
              {tab.label}
              <span className={`text-[11px] font-semibold px-1.5 py-0.5 rounded-md ${filter === tab.key ? "bg-primary/10 text-primary" : "bg-neutral-200 dark:bg-neutral-700 text-neutral-500 dark:text-neutral-400"}`}>{tab.count}</span>
            </button>
          ))}
        </div>
        {canManageConfig && (
          <Link href="/settings" className="secondary-icon px-4 py-2.5 active-scale">
            <span className="flex items-center gap-2">
              <svg className="size-4" viewBox="0 0 16 16" fill="none"><circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="1.2" /><circle cx="8" cy="8" r="2" stroke="currentColor" strokeWidth="1.2" /><path d="M8 2v2M8 12v2M2 8h2M12 8h2M3.8 3.8l1.4 1.4M10.8 10.8l1.4 1.4M12.2 3.8l-1.4 1.4M5.2 10.8l-1.4 1.4" stroke="currentColor" strokeWidth="1" strokeLinecap="round" /></svg>
              <p className="text-sm font-medium">{t("settings")}</p>
            </span>
          </Link>
        )}
      </div>

      {/* ===== RECHERCHE + FILTRES ===== */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-neutral-400" viewBox="0 0 16 16" fill="none">
            <circle cx="7" cy="7" r="5" stroke="currentColor" strokeWidth="1.3" />
            <path d="M11 11l3.5 3.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
          </svg>
          <input value={search} onChange={(e) => setSearch(e.target.value)} onKeyDown={searchKeyHandler(setSearch)} placeholder={t("search")} className="input w-full h-10 pl-9" />
        </div>
        <div className="relative">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-neutral-400 pointer-events-none" viewBox="0 0 16 16" fill="none">
            <path d="M2 4h12M4 8h8M6 12h4" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
          </svg>
          <select value={filterType} onChange={(e) => setFilterType(e.target.value)} className="input h-10 min-w-[160px] pl-9 appearance-none cursor-pointer">
            <option value="">{t("allTypes")}</option>
            {allTypes.map((ty) => (
              <option key={ty} value={ty}>{t(`types.${ty}`)}</option>
            ))}
          </select>
          <svg className="absolute right-3 top-1/2 -translate-y-1/2 size-3.5 text-neutral-400 pointer-events-none" viewBox="0 0 12 12" fill="none"><path d="M3 4.5l3 3 3-3" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" /></svg>
        </div>
        <div className="relative">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-neutral-400 pointer-events-none" viewBox="0 0 16 16" fill="none">
            <rect x="2" y="3" width="12" height="11" rx="2" stroke="currentColor" strokeWidth="1.2" />
            <path d="M2 7h12M5 1v4M11 1v4" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
          </svg>
          <select value={sortOrder} onChange={(e) => setSortOrder(e.target.value as "recent" | "oldest")} className="input h-10 min-w-[180px] pl-9 appearance-none cursor-pointer">
            <option value="recent">{t("sortRecent")}</option>
            <option value="oldest">{t("sortOldest")}</option>
          </select>
          <svg className="absolute right-3 top-1/2 -translate-y-1/2 size-3.5 text-neutral-400 pointer-events-none" viewBox="0 0 12 12" fill="none"><path d="M3 4.5l3 3 3-3" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" /></svg>
        </div>
      </div>

      {/* ===== TABLEAU ===== */}
      <div className="rounded-2xl border border-border dark:border-neutral-800 bg-white dark:bg-neutral-900 shadow-card overflow-hidden">
        {/* En-têtes */}
        <div className="hidden md:grid grid-cols-[1fr_120px_160px_100px_40px] gap-3 px-6 py-3 border-b border-border dark:border-neutral-800">
          {[t("columns.notification"), t("columns.type"), t("columns.date"), t("columns.status")].map((col, i) => (
            <span key={i} className="text-[11px] font-semibold uppercase tracking-wider text-text-secondary dark:text-neutral-500">{col}</span>
          ))}
          <span />
        </div>

        {loading ? (
          <div className="px-6 py-4 flex flex-col gap-1">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="hidden md:grid grid-cols-[1fr_120px_160px_100px_40px] gap-3 items-center py-4">
                <div className="flex items-center gap-3">
                  <Skeleton className="size-10 !rounded-xl" />
                  <div className="flex flex-col gap-1.5">
                    <Skeleton className="w-48 h-4" />
                    <Skeleton className="w-72 h-3" />
                  </div>
                </div>
                <Skeleton className="w-20 h-5 !rounded-md" />
                <Skeleton className="w-28 h-4" />
                <Skeleton className="w-16 h-4" />
                <Skeleton className="w-5 h-5 ml-auto" />
              </div>
            ))}
          </div>
        ) : paginated.length === 0 ? (
          <div className="px-6 py-16 text-center">
            <div className="flex flex-col items-center gap-5">
              <svg className="size-28" viewBox="0 0 120 120" fill="none">
                <circle cx="60" cy="50" r="28" className="fill-blue-50 dark:fill-blue-900/15 stroke-blue-200 dark:stroke-blue-800/30" strokeWidth="1.5" />
                <path d="M60 30c-8 0-15 6.5-15 14.5v10l-3 6h36l-3-6v-10c0-8-7-14.5-15-14.5z" className="fill-blue-100 dark:fill-blue-900/25 stroke-blue-300 dark:stroke-blue-700/50" strokeWidth="1.5" strokeLinejoin="round" />
                <path d="M53 62a7.5 7.5 0 0014 0" className="stroke-blue-300 dark:stroke-blue-700/50" strokeWidth="1.5" />
                <path d="M25 45l2 4 4 1-3 3 .5 4-3.5-2-3.5 2 .5-4-3-3 4-1 2-4z" className="fill-primary/15" />
                <circle cx="95" cy="38" r="2" className="fill-emerald-400/25" />
                <circle cx="30" cy="75" r="1.5" className="fill-amber-400/25" />
                <path d="M88 60l1.5 3 3 .7-2.2 2.2.4 3-2.7-1.5-2.7 1.5.4-3-2.2-2.2 3-.7 1.5-3z" className="fill-blue-400/15" />
              </svg>
              <div>
                <p className="text-base font-bold text-black dark:text-white">{filter === "unread" ? t("emptyUnread") : t("empty")}</p>
                <p className="text-sm text-text-secondary dark:text-neutral-500 mt-2 max-w-md mx-auto leading-relaxed">{t("emptyDescription")}</p>
              </div>
            </div>
          </div>
        ) : (
          <div className="divide-y divide-border dark:divide-neutral-800">
            {paginated.map((notif) => {
              const nType = notif.type;
              const style = TYPE_STYLES[nType] ?? TYPE_STYLES.VALIDATION_REQUIRED;
              return (
                <div key={notif.id} className={`grid grid-cols-1 md:grid-cols-[1fr_120px_160px_100px_40px] gap-2 md:gap-3 items-center px-6 py-4 transition-colors ${!notif.read ? "bg-blue-50/30 dark:bg-blue-900/5" : "hover:bg-neutral-50 dark:hover:bg-neutral-800/30"}`}>
                  {/* Notification */}
                  <div className="flex items-center gap-3 min-w-0">
                    <div className={`size-10 rounded-xl flex items-center justify-center shrink-0 ${style.icon}`}>
                      {TYPE_ICONS[nType] ?? TYPE_ICONS.VALIDATION_REQUIRED}
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-black dark:text-white truncate">{notif.title}</p>
                      <p className="text-xs text-text-secondary dark:text-neutral-400 mt-0.5 line-clamp-1">{notif.message}</p>
                    </div>
                  </div>

                  {/* Type badge */}
                  <span className={`inline-flex items-center w-fit px-2.5 py-0.5 text-[11px] font-semibold rounded-md ${style.badge}`}>
                    {t(`types.${nType}`)}
                  </span>

                  {/* Date */}
                  <span className="text-xs text-text-secondary dark:text-neutral-400">{formatDate(notif.createdAt)}</span>

                  {/* Statut */}
                  <div className="flex items-center gap-1.5">
                    <span className={`size-2 rounded-full shrink-0 ${!notif.read ? "bg-blue-500" : "bg-neutral-300 dark:bg-neutral-600"}`} />
                    <span className={`text-xs font-medium ${!notif.read ? "text-blue-600 dark:text-blue-400" : "text-neutral-400 dark:text-neutral-500"}`}>{!notif.read ? t("readStatus.unread") : t("readStatus.read")}</span>
                  </div>

                  {/* Actions */}
                  <div className="flex justify-end relative" onClick={(e) => e.stopPropagation()}>
                    <button onClick={() => setOpenMenuId(openMenuId === notif.id ? null : notif.id)} className="p-1.5 rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors cursor-pointer">
                      <svg className="size-5 text-neutral-500 dark:text-neutral-400" viewBox="0 0 16 16" fill="none">
                        <circle cx="8" cy="3" r="1.2" fill="currentColor" /><circle cx="8" cy="8" r="1.2" fill="currentColor" /><circle cx="8" cy="13" r="1.2" fill="currentColor" />
                      </svg>
                    </button>
                    {openMenuId === notif.id && (
                      <div className="absolute right-0 top-full mt-1 z-40 bg-white dark:bg-neutral-800 border border-border dark:border-neutral-700 rounded-xl shadow-lg p-1 min-w-[180px] animate-fade-in">
                        {!notif.read && (
                          <button onClick={() => { markAsRead(notif.id); setOpenMenuId(null); }} className="flex items-center gap-2 w-full px-3 py-2 text-sm text-black dark:text-white rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-700 transition-colors">
                            <svg className="size-4 text-emerald-500" viewBox="0 0 16 16" fill="none"><path d="M3 8l3.5 3.5L13 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
                            {t("markAsRead")}
                          </button>
                        )}
                        {unreadCount > 1 && (
                          <button onClick={() => { markAllAsRead(); setOpenMenuId(null); }} className="flex items-center gap-2 w-full px-3 py-2 text-sm text-black dark:text-white rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-700 transition-colors">
                            <svg className="size-4 text-blue-500" viewBox="0 0 16 16" fill="none"><path d="M2 8l4 4 8-8" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" /><path d="M6 12l-1.5 1.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" /></svg>
                            {t("markAllRead")}
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Pagination */}
        {sorted.length > PER_PAGE && (
          <div className="flex items-center justify-between px-6 py-3 border-t border-border dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-800/20">
            <span className="text-xs text-text-secondary dark:text-neutral-500">
              {t("pagination", { from: (page - 1) * PER_PAGE + 1, to: Math.min(page * PER_PAGE, sorted.length), total: sorted.length })}
            </span>
            <div className="flex items-center gap-1">
              <button onClick={() => setPage(Math.max(1, page - 1))} disabled={page === 1} className="size-8 rounded-lg flex items-center justify-center border border-border dark:border-neutral-700 hover:bg-neutral-100 dark:hover:bg-neutral-700 transition-colors disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer">
                <svg className="size-3.5 text-neutral-600 dark:text-neutral-300" viewBox="0 0 12 12" fill="none"><path d="M7.5 2.5L4 6l3.5 3.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" /></svg>
              </button>
              {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
                <button key={p} onClick={() => setPage(p)} className={`size-8 rounded-lg flex items-center justify-center text-xs font-medium transition-colors cursor-pointer ${page === p ? "bg-primary text-white" : "border border-border dark:border-neutral-700 text-neutral-600 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-700"}`}>{p}</button>
              ))}
              <button onClick={() => setPage(Math.min(totalPages, page + 1))} disabled={page === totalPages} className="size-8 rounded-lg flex items-center justify-center border border-border dark:border-neutral-700 hover:bg-neutral-100 dark:hover:bg-neutral-700 transition-colors disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer">
                <svg className="size-3.5 text-neutral-600 dark:text-neutral-300" viewBox="0 0 12 12" fill="none"><path d="M4.5 2.5L8 6l-3.5 3.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" /></svg>
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ===== BANNIÈRE EMAIL ===== */}
      {canManageConfig && (
      <div className="rounded-2xl bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 border border-blue-200 dark:border-blue-800/30 p-6 flex items-center gap-5">
        <div className="size-14 rounded-2xl bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center shrink-0">
          <svg className="size-7 text-blue-600 dark:text-blue-400" viewBox="0 0 24 24" fill="none">
            <path d="M12 5c-4 0-7.5 3-7.5 7v4l-1.5 3h18l-1.5-3v-4c0-4-3.5-7-7.5-7z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
            <path d="M9 20a3.5 3.5 0 007 0" stroke="currentColor" strokeWidth="1.5" />
            <circle cx="18" cy="7" r="3" className="fill-primary stroke-blue-50 dark:stroke-blue-900/20" strokeWidth="2" />
          </svg>
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold text-black dark:text-white">{t("banner.title")}</p>
          <p className="text-xs text-text-secondary dark:text-neutral-400 mt-1 leading-relaxed">{t("banner.description")}</p>
        </div>
        <Link href="/settings" className="primary-icon px-5 py-2.5 active-scale shrink-0">
          <span className="flex items-center gap-2">
            <svg className="size-4" viewBox="0 0 16 16" fill="none"><rect x="1.5" y="3" width="13" height="10" rx="2" stroke="currentColor" strokeWidth="1.2" /><path d="M1.5 5.5L8 9.5l6.5-4" stroke="currentColor" strokeWidth="1.2" /></svg>
            <p className="text-sm font-medium whitespace-nowrap">{t("banner.cta")}</p>
          </span>
        </Link>
      </div>
      )}
    </div>
  );
}
