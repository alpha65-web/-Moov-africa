"use client";

import { useEffect, useState } from "react";
import api from "@/lib/api";
import type { Notification } from "@/lib/types";
import toast from "react-hot-toast";

export default function NotificationsPage() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [unreadCount, setUnreadCount] = useState(0);
  const [filter, setFilter] = useState<"all" | "unread" | "read">("all");

  useEffect(() => {
    loadNotifications();
    loadUnreadCount();
  }, []);

  async function loadNotifications() {
    try {
      const { data } = await api.get("/notifications");
      setNotifications(data.content ?? data);
    } catch {
      /* API pas disponible */
    } finally {
      setLoading(false);
    }
  }

  async function loadUnreadCount() {
    try {
      const { data } = await api.get("/notifications/unread/count");
      setUnreadCount(typeof data === "number" ? data : data.count ?? 0);
    } catch { /* */ }
  }

  async function markAsRead(id: string) {
    try {
      await api.patch(`/notifications/${id}/read`);
      loadNotifications();
      loadUnreadCount();
    } catch {
      setNotifications((prev) => prev.map((n) => n.id === id ? { ...n, read: true } : n));
      setUnreadCount((prev) => Math.max(0, prev - 1));
    }
  }

  async function markAllAsRead() {
    try {
      await api.patch("/notifications/read-all");
      toast.success("Toutes les notifications marquées comme lues");
      loadNotifications();
      loadUnreadCount();
    } catch {
      setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
      setUnreadCount(0);
      toast.success("Toutes les notifications marquées comme lues");
    }
  }

  function timeAgo(dateStr: string): string {
    const now = new Date();
    const date = new Date(dateStr);
    const diff = Math.floor((now.getTime() - date.getTime()) / 1000);
    if (diff < 60) return "A l'instant";
    if (diff < 3600) return `Il y a ${Math.floor(diff / 60)} min`;
    if (diff < 86400) return `Il y a ${Math.floor(diff / 3600)}h`;
    return `Il y a ${Math.floor(diff / 86400)}j`;
  }

  const TYPE_ICONS: Record<string, string> = {
    INFO: "text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20",
    WARNING: "text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20",
    ERROR: "text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20",
    SUCCESS: "text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/20",
  };

  const filtered = notifications.filter((n) => {
    if (filter === "unread") return !n.read;
    if (filter === "read") return n.read;
    return true;
  });

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-black dark:text-white">Notifications</h1>
          <p className="text-sm text-text-secondary dark:text-neutral-500 mt-0.5">
            {unreadCount > 0
              ? `${unreadCount} non lue${unreadCount > 1 ? "s" : ""}`
              : "Toutes les notifications sont lues"}
          </p>
        </div>
        {unreadCount > 0 && (
          <button onClick={markAllAsRead} className="secondary-icon px-3 py-2.5 active-scale">
            <span className="flex items-center gap-2">
              <svg className="size-4" viewBox="0 0 16 16" fill="none">
                <path d="M2 8l4 4 8-8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                <path d="M6 12l-1.5 1.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
              <p className="text-sm font-medium">Tout marquer comme lu</p>
            </span>
          </button>
        )}
      </div>

      {/* Filtres */}
      <div className="flex gap-1 p-1 rounded-xl bg-neutral-100 dark:bg-neutral-800/50 border border-border dark:border-neutral-800 w-fit">
        {([
          { key: "all" as const, label: "Toutes", count: notifications.length },
          { key: "unread" as const, label: "Non lues", count: unreadCount },
          { key: "read" as const, label: "Lues", count: notifications.length - unreadCount },
        ]).map((t) => (
          <button
            key={t.key}
            onClick={() => setFilter(t.key)}
            className={`px-4 py-2 text-sm font-medium transition-all cursor-pointer ${
              filter === t.key
                ? "bg-white dark:bg-neutral-700 text-black dark:text-white shadow-sm"
                : "text-text-secondary dark:text-neutral-400 hover:text-black dark:hover:text-white"
            }`}
            style={{ borderRadius: 8 }}
          >
            {t.label}
            <span className={`ml-1.5 text-[11px] ${filter === t.key ? "text-primary" : "text-neutral-400"}`}>
              {t.count}
            </span>
          </button>
        ))}
      </div>

      {/* Liste */}
      <div className="rounded-2xl border border-border dark:border-neutral-800 bg-white dark:bg-neutral-900 shadow-card overflow-hidden">
        {loading ? (
          <div className="px-6 py-4 flex flex-col gap-3">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="flex items-center gap-3">
                <div className="size-9 rounded-xl bg-neutral-100 dark:bg-neutral-800 animate-pulse" />
                <div className="flex-1 flex flex-col gap-1.5">
                  <div className="w-48 h-4 rounded bg-neutral-100 dark:bg-neutral-800 animate-pulse" />
                  <div className="w-64 h-3 rounded bg-neutral-100 dark:bg-neutral-800 animate-pulse" />
                </div>
              </div>
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="px-6 py-12 text-center">
            <div className="flex flex-col items-center gap-3">
              <div className="size-12 rounded-xl bg-neutral-100 dark:bg-neutral-800 flex items-center justify-center">
                <svg className="size-6 text-neutral-400" viewBox="0 0 16 16" fill="none">
                  <path d="M8 1.5c-2.5 0-4.5 2-4.5 4.5v3l-1 2h11l-1-2v-3c0-2.5-2-4.5-4.5-4.5z" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round" />
                  <path d="M6 12a2 2 0 004 0" stroke="currentColor" strokeWidth="1.2" />
                </svg>
              </div>
              <p className="text-sm text-text-secondary dark:text-neutral-500">
                {filter === "unread" ? "Aucune notification non lue" : "Aucune notification"}
              </p>
            </div>
          </div>
        ) : (
          <div className="divide-y divide-border dark:divide-neutral-800">
            {filtered.map((notif) => (
              <div
                key={notif.id}
                className={`flex items-start gap-3 px-6 py-4 transition-colors ${
                  !notif.read ? "bg-blue-50/40 dark:bg-blue-900/10" : "hover:bg-neutral-50 dark:hover:bg-neutral-800/30"
                }`}
              >
                <div className={`size-9 rounded-xl flex items-center justify-center shrink-0 mt-0.5 ${TYPE_ICONS[notif.type] || TYPE_ICONS.INFO}`}>
                  <svg className="size-4" viewBox="0 0 16 16" fill="none">
                    <path d="M8 1.5c-2.5 0-4.5 2-4.5 4.5v3l-1 2h11l-1-2v-3c0-2.5-2-4.5-4.5-4.5z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" />
                    <path d="M6 12a2 2 0 004 0" stroke="currentColor" strokeWidth="1.3" />
                  </svg>
                </div>

                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-bold text-black dark:text-white truncate">
                      {notif.title}
                    </p>
                    {!notif.read && (
                      <span className="size-2 rounded-full bg-blue-600 shrink-0" />
                    )}
                  </div>
                  <p className="text-xs text-text-secondary dark:text-neutral-400 mt-0.5 line-clamp-2">
                    {notif.message}
                  </p>
                  <p className="text-[11px] text-neutral-400 dark:text-neutral-600 mt-1">
                    {timeAgo(notif.createdAt)}
                  </p>
                </div>

                {!notif.read && (
                  <button
                    onClick={() => markAsRead(notif.id)}
                    title="Marquer comme lu"
                    className="shrink-0 p-1.5 rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors mt-0.5"
                  >
                    <svg className="size-4 text-black dark:text-white" viewBox="0 0 16 16" fill="none">
                      <path d="M3 8l3.5 3.5L13 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
