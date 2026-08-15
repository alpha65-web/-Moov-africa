"use client";

import { useEffect, useState } from "react";
import api from "@/lib/api";
import type { Notification } from "@/lib/types";
import toast from "react-hot-toast";
import { Bell, CheckCheck } from "lucide-react";

export default function NotificationsPage() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    loadNotifications();
    loadUnreadCount();
  }, []);

  async function loadNotifications() {
    try {
      const { data } = await api.get("/notifications");
      setNotifications(data);
    } catch {
      // API not available
    } finally {
      setLoading(false);
    }
  }

  async function loadUnreadCount() {
    try {
      const { data } = await api.get("/notifications/unread/count");
      setUnreadCount(data);
    } catch {
      // ignore
    }
  }

  async function markAsRead(id: string) {
    try {
      await api.patch(`/notifications/${id}/read`);
      loadNotifications();
      loadUnreadCount();
    } catch {
      toast.error("Erreur");
    }
  }

  async function markAllAsRead() {
    try {
      await api.patch("/notifications/read-all");
      toast.success("Toutes les notifications marquees comme lues");
      loadNotifications();
      loadUnreadCount();
    } catch {
      toast.error("Erreur");
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

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            Notifications
          </h1>
          <p className="mt-1 text-sm text-gray-500">
            {unreadCount > 0
              ? `${unreadCount} notification(s) non lue(s)`
              : "Toutes les notifications sont lues"}
          </p>
        </div>
        {unreadCount > 0 && (
          <button
            onClick={markAllAsRead}
            className="flex items-center gap-2 rounded-lg border border-gray-300 px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-300"
          >
            <CheckCheck className="h-4 w-4" />
            Tout marquer comme lu
          </button>
        )}
      </div>

      <div className="rounded-xl border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-900">
        {loading ? (
          <div className="p-8 text-center text-sm text-gray-500">
            Chargement...
          </div>
        ) : notifications.length === 0 ? (
          <div className="p-8 text-center text-sm text-gray-500">
            <Bell className="mx-auto mb-3 h-12 w-12 text-gray-300" />
            <p>Aucune notification</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-200 dark:divide-gray-700">
            {notifications.map((notif) => (
              <div
                key={notif.id}
                className={`flex items-start gap-4 px-6 py-4 ${
                  !notif.read ? "bg-blue-50/50 dark:bg-blue-900/10" : ""
                }`}
              >
                <div
                  className={`mt-1 h-2 w-2 shrink-0 rounded-full ${
                    notif.read ? "bg-transparent" : "bg-blue-600"
                  }`}
                />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-gray-900 dark:text-white">
                    {notif.title}
                  </p>
                  <p className="mt-0.5 text-sm text-gray-500">
                    {notif.message}
                  </p>
                  <p className="mt-1 text-xs text-gray-400">
                    {timeAgo(notif.createdAt)}
                  </p>
                </div>
                {!notif.read && (
                  <button
                    onClick={() => markAsRead(notif.id)}
                    className="shrink-0 text-xs text-blue-600 hover:underline dark:text-blue-400"
                  >
                    Marquer lu
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
