"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  useRef,
  type ReactNode,
} from "react";
import toast from "react-hot-toast";

interface NotificationData {
  id: string;
  type: string;
  title: string;
  message: string;
  read: boolean;
  relatedOfferId: string | null;
  createdAt: string;
}

interface NotificationContextType {
  unreadCount: number;
  latestNotification: NotificationData | null;
  refreshCount: () => void;
}

const NotificationContext = createContext<NotificationContextType>({
  unreadCount: 0,
  latestNotification: null,
  refreshCount: () => {},
});

export function NotificationProvider({ children }: { children: ReactNode }) {
  const [unreadCount, setUnreadCount] = useState(0);
  const [latestNotification, setLatestNotification] =
    useState<NotificationData | null>(null);
  const eventSourceRef = useRef<EventSource | null>(null);
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(
    null
  );

  const connect = useCallback(() => {
    const token =
      typeof window !== "undefined"
        ? localStorage.getItem("accessToken")
        : null;
    if (!token) return;

    if (eventSourceRef.current) {
      eventSourceRef.current.close();
    }

    const es = new EventSource(
      `/api/v1/notifications/stream?token=${encodeURIComponent(token)}`
    );
    eventSourceRef.current = es;

    es.addEventListener("notification", (e) => {
      try {
        const data: NotificationData = JSON.parse(e.data);
        setLatestNotification(data);
        setUnreadCount((prev) => prev + 1);
        toast(
          data.title +
            (data.message ? ` · ${data.message.slice(0, 80)}` : ""),
          {
            icon: getNotificationIcon(data.type),
            duration: 5000,
            style: { fontSize: "13px", maxWidth: "400px" },
          }
        );
      } catch {
        /* ignore parse errors */
      }
    });

    es.addEventListener("unread-count", (e) => {
      try {
        const data = JSON.parse(e.data);
        setUnreadCount(data.count ?? 0);
      } catch {
        /* ignore */
      }
    });

    es.onerror = () => {
      es.close();
      eventSourceRef.current = null;
      reconnectTimeoutRef.current = setTimeout(connect, 5000);
    };
  }, []);

  const refreshCount = useCallback(async () => {
    try {
      const token = localStorage.getItem("accessToken");
      if (!token) return;
      const res = await fetch("/api/v1/notifications/unread/count", {
        headers: {
          Authorization: `Bearer ${token}`,
          "X-Fingerprint": localStorage.getItem("fingerprint") || "",
        },
      });
      if (res.ok) {
        const data = await res.json();
        setUnreadCount(typeof data === "number" ? data : (data.count ?? 0));
      }
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    refreshCount();
    connect();

    return () => {
      if (eventSourceRef.current) eventSourceRef.current.close();
      if (reconnectTimeoutRef.current)
        clearTimeout(reconnectTimeoutRef.current);
    };
  }, [connect, refreshCount]);

  return (
    <NotificationContext.Provider
      value={{ unreadCount, latestNotification, refreshCount }}
    >
      {children}
    </NotificationContext.Provider>
  );
}

export function useNotifications() {
  return useContext(NotificationContext);
}

function getNotificationIcon(type: string): string {
  switch (type) {
    case "OFFER_PUBLISHED":
      return "\u{1F680}";
    case "OFFER_REJECTED":
      return "⚠️";
    case "ENRICHMENT_REQUIRED":
      return "✏️";
    case "VALIDATION_REQUIRED":
      return "✅";
    case "MEDIA_VALIDATED":
      return "\u{1F5BC}️";
    case "CAMPAIGN_LAUNCHED":
      return "\u{1F4E2}";
    case "AI_TASK_COMPLETED":
      return "\u{1F916}";
    case "CATALOG_CREATED":
      return "\u{1F4E6}";
    default:
      return "\u{1F514}";
  }
}
