"use client";

import { useEffect, useState, useMemo } from "react";
import { useAuth } from "@/lib/auth";
import api from "@/lib/api";
import Link from "next/link";
import type { Offer, CatalogItem, Campaign, OfferStatus, Notification, BusinessRule, User } from "@/lib/types";
import { useTranslations } from "next-intl";
import {
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell,
  BarChart, Bar,
  LineChart, Line,
  RadarChart, Radar, PolarGrid, PolarAngleAxis,
} from "recharts";

/* ── Micro components ── */

function ProgressBar({ value, color }: { value: number; color: string }) {
  return (
    <div className="h-[5px] w-full rounded-full bg-neutral-100 dark:bg-white/[0.06] overflow-hidden">
      <div className={`h-full rounded-full transition-all duration-700 ease-out ${color}`} style={{ width: `${Math.min(100, Math.max(0, value))}%` }} />
    </div>
  );
}

function Skeleton({ className = "" }: { className?: string }) {
  return <div className={`rounded-lg bg-neutral-100 dark:bg-white/[0.04] animate-pulse ${className}`} />;
}

function Sparkline({ data, className = "" }: { data: number[]; className?: string }) {
  if (data.length < 2) return null;
  const max = Math.max(...data, 1), min = Math.min(...data, 0), range = max - min || 1;
  const w = 80, h = 32;
  const pts = data.map((v, i) => ({
    x: (i / (data.length - 1)) * w,
    y: h - ((v - min) / range) * h * 0.65 - h * 0.15,
  }));
  let d = `M ${pts[0].x},${pts[0].y}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[Math.max(0, i - 1)], p1 = pts[i], p2 = pts[i + 1], p3 = pts[Math.min(pts.length - 1, i + 2)];
    d += ` C ${p1.x + (p2.x - p0.x) / 5},${p1.y + (p2.y - p0.y) / 5} ${p2.x - (p3.x - p1.x) / 5},${p2.y - (p3.y - p1.y) / 5} ${p2.x},${p2.y}`;
  }
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className={className} preserveAspectRatio="none" fill="none">
      <path d={`${d} L ${w},${h} L 0,${h} Z`} fill="currentColor" opacity="0.08" />
      <path d={d} stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

/* ── Chart type icons ── */

function ChartTypeIcon({ type, active }: { type: string; active: boolean }) {
  const cls = `size-3.5 ${active ? "text-neutral-900 dark:text-white" : "text-neutral-400 dark:text-neutral-500"}`;
  switch (type) {
    case "area":
      return <svg className={cls} viewBox="0 0 16 16" fill="none"><path d="M1 12l4-5 3 3 7-8" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" /><path d="M1 12l4-5 3 3 7-8v10H1z" fill="currentColor" opacity="0.1" /></svg>;
    case "bar":
      return <svg className={cls} viewBox="0 0 16 16" fill="none"><rect x="1" y="8" width="3" height="6" rx="0.5" fill="currentColor" opacity={active ? 0.7 : 0.4} /><rect x="6.5" y="4" width="3" height="10" rx="0.5" fill="currentColor" opacity={active ? 0.85 : 0.4} /><rect x="12" y="6" width="3" height="8" rx="0.5" fill="currentColor" opacity={active ? 1 : 0.4} /></svg>;
    case "line":
      return <svg className={cls} viewBox="0 0 16 16" fill="none"><path d="M1 12l4-5 3 3 7-8" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" /><circle cx="5" cy="7" r="1.2" fill="currentColor" /><circle cx="8" cy="10" r="1.2" fill="currentColor" /><circle cx="15" cy="2" r="1.2" fill="currentColor" /></svg>;
    case "donut":
      return <svg className={cls} viewBox="0 0 16 16" fill="none"><circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="1.4" /><circle cx="8" cy="8" r="3" stroke="currentColor" strokeWidth="1.4" /></svg>;
    case "radar":
      return <svg className={cls} viewBox="0 0 16 16" fill="none"><polygon points="8,1 14,5 12,12 4,12 2,5" stroke="currentColor" strokeWidth="1.2" fill="currentColor" opacity="0.1" strokeLinejoin="round" /><polygon points="8,4 11,6.5 10,10 6,10 5,6.5" stroke="currentColor" strokeWidth="1.2" fill="currentColor" opacity="0.15" strokeLinejoin="round" /></svg>;
    default:
      return null;
  }
}

function ChartTypeSwitcher<T extends string>({ types, active, onChange }: { types: T[]; active: T; onChange: (t: T) => void }) {
  return (
    <div className="flex h-7 rounded-lg bg-neutral-100 dark:bg-white/[0.04] p-0.5 gap-0.5">
      {types.map(type => (
        <button key={type} onClick={() => onChange(type)}
          className={`flex items-center justify-center w-7 rounded-md transition-all ${active === type ? "bg-white dark:bg-white/[0.1] shadow-sm" : "hover:bg-white/50 dark:hover:bg-white/[0.05]"}`}
          title={type}
        >
          <ChartTypeIcon type={type} active={active === type} />
        </button>
      ))}
    </div>
  );
}

/* ── Constants ── */

const PIPELINE: { key: OfferStatus; hex: string; tw: string }[] = [
  { key: "DRAFT", hex: "#94a3b8", tw: "bg-neutral-400" },
  { key: "IN_ENRICHMENT", hex: "#3b82f6", tw: "bg-blue-500" },
  { key: "IN_VALIDATION", hex: "#f59e0b", tw: "bg-amber-500" },
  { key: "VALIDATED", hex: "#10b981", tw: "bg-emerald-500" },
  { key: "PLANNED", hex: "#8b5cf6", tw: "bg-violet-500" },
  { key: "PUBLISHED", hex: "#14b8a6", tw: "bg-teal-500" },
];

const STATUS_HEX: Record<string, string> = {
  DRAFT: "#94a3b8", IN_ENRICHMENT: "#3b82f6", IN_VALIDATION: "#f59e0b",
  VALIDATED: "#10b981", PLANNED: "#8b5cf6", PUBLISHED: "#14b8a6",
  SUSPENDED: "#f97316", OBSOLETE: "#ef4444", WITHDRAWN: "#dc2626", ARCHIVED: "#cbd5e1",
};

const CHANNEL_HEX: Record<string, string> = {
  SMS: "#3b82f6", EMAIL: "#8b5cf6", PUSH_NOTIFICATION: "#ec4899",
  USSD: "#f59e0b", FACEBOOK: "#2563eb", INSTAGRAM: "#f43f5e",
  LINKEDIN: "#0284c7", SOCIAL_MEDIA: "#14b8a6", PARTNER_SITE: "#f97316",
};

const DAY_NAMES = ["Dim", "Lun", "Mar", "Mer", "Jeu", "Ven", "Sam"];
const MONTH_NAMES = ["Jan", "Fev", "Mar", "Avr", "Mai", "Jun", "Jul", "Aou", "Sep", "Oct", "Nov", "Dec"];

/* ── Tooltip ── */
function ChartTooltip({ active, payload, label }: { active?: boolean; payload?: Array<{ value: number; name: string; color: string }>; label?: string }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="surface px-3 py-2.5 text-xs !shadow-xl">
      <p className="font-medium text-neutral-900 dark:text-white mb-1.5">{label}</p>
      {payload.map((p, i) => (
        <div key={i} className="flex items-center gap-2 py-0.5">
          <span className="size-[6px] rounded-full shrink-0" style={{ background: p.color }} />
          <span className="text-neutral-500 dark:text-neutral-400">{p.name}</span>
          <span className="font-semibold text-neutral-900 dark:text-white ml-auto tabular-nums">{p.value}</span>
        </div>
      ))}
    </div>
  );
}

/* ════════════════════════════════════════════════ */
export default function DashboardPage() {
  const { user } = useAuth();
  const t = useTranslations("dashboard");
  const ts = useTranslations("offers.status");

  const [offers, setOffers] = useState<Offer[]>([]);
  const [catalogItems, setCatalogItems] = useState<CatalogItem[]>([]);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [rules, setRules] = useState<BusinessRule[]>([]);
  const [mediaCount, setMediaCount] = useState(0);
  const [auditLogs, setAuditLogs] = useState<Array<{ id: string; userId: string; action: string; entityType: string; entityId: string; createdAt: string }>>([]);
  const [loading, setLoading] = useState(true);
  const [chartPeriod, setChartPeriod] = useState<"7d" | "30d" | "90d">("30d");
  const [activityChartType, setActivityChartType] = useState<"area" | "bar" | "line">("area");
  const [statusChartType, setStatusChartType] = useState<"donut" | "bar" | "radar">("donut");
  const [isDark, setIsDark] = useState(false);
  const [periodFilter, setPeriodFilter] = useState<"all" | "7d" | "30d" | "90d">("all");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");

  useEffect(() => {
    const check = () => setIsDark(document.documentElement.classList.contains("dark"));
    check();
    const obs = new MutationObserver(check);
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
    return () => obs.disconnect();
  }, []);

  useEffect(() => {
    async function load() {
      try {
        const [offersRes, catalogRes, usersRes, campaignsRes, auditRes, notifRes, rulesRes, mediaRes] = await Promise.all([
          api.get("/offers").catch(() => ({ data: [] })),
          api.get("/catalog").catch(() => ({ data: [] })),
          api.get("/users").catch(() => ({ data: [] })),
          api.get("/campaigns/mine").catch(() => ({ data: [] })),
          api.get("/audit-logs?size=8").catch(() => ({ data: { content: [] } })),
          api.get("/notifications").catch(() => ({ data: [] })),
          api.get("/rules").catch(() => ({ data: [] })),
          api.get("/media").catch(() => ({ data: [] })),
        ]);
        setOffers(offersRes.data.content ?? offersRes.data ?? []);
        setCatalogItems(Array.isArray(catalogRes.data) ? catalogRes.data : []);
        setCampaigns(Array.isArray(campaignsRes.data) ? campaignsRes.data : []);
        const usersData = Array.isArray(usersRes.data) ? usersRes.data : [];
        setUsers(usersData);
        const logs = auditRes.data.content ?? auditRes.data ?? [];
        setAuditLogs(Array.isArray(logs) ? logs.slice(0, 8) : []);
        const notifData = notifRes.data.content ?? notifRes.data ?? [];
        setNotifications(Array.isArray(notifData) ? notifData : []);
        const rulesData = rulesRes.data.content ?? rulesRes.data ?? [];
        setRules(Array.isArray(rulesData) ? rulesData : []);
        const mediaData = mediaRes.data.content ?? mediaRes.data ?? [];
        setMediaCount(Array.isArray(mediaData) ? mediaData.length : 0);
      } catch { /* API unavailable */ }
      finally { setLoading(false); }
    }
    load();
  }, []);

  /* ── Filtered offers ── */
  const filteredOffers = useMemo(() => {
    let result = offers;
    if (periodFilter !== "all") {
      const ms = periodFilter === "7d" ? 7 * 86400000 : periodFilter === "30d" ? 30 * 86400000 : 90 * 86400000;
      const cutoff = Date.now() - ms;
      result = result.filter(o => new Date(o.createdAt).getTime() >= cutoff);
    }
    if (statusFilter !== "ALL") {
      result = result.filter(o => o.status === statusFilter);
    }
    return result;
  }, [offers, periodFilter, statusFilter]);

  const allStatuses: OfferStatus[] = ["DRAFT", "IN_ENRICHMENT", "IN_VALIDATION", "VALIDATED", "PLANNED", "PUBLISHED", "SUSPENDED", "OBSOLETE", "WITHDRAWN", "ARCHIVED"];
  const isFiltered = periodFilter !== "all" || statusFilter !== "ALL";

  /* ── Computed data ── */
  const pipelineCounts = useMemo(() => {
    const c: Record<string, number> = {};
    PIPELINE.forEach(s => (c[s.key] = 0));
    filteredOffers.forEach(o => { if (c[o.status] !== undefined) c[o.status]++; });
    return c;
  }, [filteredOffers]);
  const totalPipeline = useMemo(() => Object.values(pipelineCounts).reduce((a, b) => a + b, 0), [pipelineCounts]);
  const archivedCount = useMemo(() => filteredOffers.filter(o => ["SUSPENDED", "OBSOLETE", "WITHDRAWN", "ARCHIVED"].includes(o.status)).length, [filteredOffers]);
  const activeCampaigns = useMemo(() => campaigns.filter(c => c.status === "PUBLISHED" || c.status === "SCHEDULED"), [campaigns]);
  const channelTypes = useMemo(() => {
    const types = new Set<string>();
    activeCampaigns.forEach(c => c.channels?.forEach(ch => types.add(ch.channelType)));
    return Array.from(types);
  }, [activeCampaigns]);
  const catalogHealth = useMemo(() => {
    if (!catalogItems.length) return { withDesc: 0, withPrice: 0, withCat: 0, overall: 0 };
    const n = catalogItems.length;
    const wd = catalogItems.filter(i => i.description?.trim()).length;
    const wp = catalogItems.filter(i => i.basePrice > 0).length;
    const wc = catalogItems.filter(i => i.categoryId).length;
    return { withDesc: Math.round((wd / n) * 100), withPrice: Math.round((wp / n) * 100), withCat: Math.round((wc / n) * 100), overall: Math.round(((wd + wp + wc) / (n * 3)) * 100) };
  }, [catalogItems]);
  const enrichmentRate = useMemo(() => {
    if (!filteredOffers.length) return 0;
    return Math.round((filteredOffers.filter(o => o.shortDescription?.trim() && o.longDescription?.trim()).length / filteredOffers.length) * 100);
  }, [filteredOffers]);
  const sparklineData = useMemo(() => {
    const now = Date.now();
    return Array.from({ length: 7 }, (_, i) => {
      const s = new Date(now - (6 - i) * 86400000); s.setHours(0, 0, 0, 0);
      return filteredOffers.filter(o => { const d = new Date(o.createdAt).getTime(); return d >= s.getTime() && d < s.getTime() + 86400000; }).length;
    });
  }, [filteredOffers]);

  const offerActivityData = useMemo(() => {
    const now = Date.now();
    const buckets: { start: number; end: number; label: string }[] = [];
    if (chartPeriod === "7d") {
      for (let i = 6; i >= 0; i--) { const d = new Date(now - i * 86400000); d.setHours(0, 0, 0, 0); buckets.push({ start: d.getTime(), end: d.getTime() + 86400000, label: DAY_NAMES[d.getDay()] }); }
    } else if (chartPeriod === "30d") {
      for (let i = 5; i >= 0; i--) { const end = new Date(now - i * 5 * 86400000); end.setHours(0, 0, 0, 0); const start = new Date(end.getTime() - 5 * 86400000); buckets.push({ start: start.getTime(), end: end.getTime(), label: `${new Date(start).getDate()}/${new Date(start).getMonth() + 1}` }); }
    } else {
      for (let i = 2; i >= 0; i--) { const d = new Date(now); d.setMonth(d.getMonth() - i, 1); d.setHours(0, 0, 0, 0); const end = new Date(d); end.setMonth(end.getMonth() + 1); buckets.push({ start: d.getTime(), end: end.getTime(), label: MONTH_NAMES[d.getMonth()] }); }
    }
    return buckets.map(b => ({
      name: b.label,
      [t("created")]: filteredOffers.filter(o => { const d = new Date(o.createdAt).getTime(); return d >= b.start && d < b.end; }).length,
      [t("published")]: filteredOffers.filter(o => { if (o.status !== "PUBLISHED") return false; const d = new Date(o.updatedAt || o.createdAt).getTime(); return d >= b.start && d < b.end; }).length,
    }));
  }, [filteredOffers, chartPeriod, t]);

  const statusDistribution = useMemo(() => {
    const counts: Record<string, number> = {};
    filteredOffers.forEach(o => (counts[o.status] = (counts[o.status] || 0) + 1));
    return Object.entries(counts).filter(([, v]) => v > 0).map(([status, value]) => ({
      name: ts.has(status) ? ts(status) : status, value, color: STATUS_HEX[status] || "#94a3b8",
    }));
  }, [filteredOffers, ts]);

  const channelDistribution = useMemo(() => {
    const counts: Record<string, number> = {};
    campaigns.forEach(c => c.channels?.forEach(ch => (counts[ch.channelType] = (counts[ch.channelType] || 0) + 1)));
    return Object.entries(counts).sort(([, a], [, b]) => b - a).map(([type, count]) => ({ name: type, value: count, fill: CHANNEL_HEX[type] || "#94a3b8" }));
  }, [campaigns]);

  const actionItems = useMemo(() => {
    const items: { id: string; label: string; detail: string; href: string; severity: 0 | 1 | 2 }[] = [];
    filteredOffers.filter(o => o.status === "IN_VALIDATION").forEach(o => {
      const days = Math.max(1, Math.floor((Date.now() - new Date(o.updatedAt || o.createdAt).getTime()) / 86400000));
      items.push({ id: `val-${o.id}`, label: o.name, detail: t("pendingSince", { days: String(days) }), href: "/offers", severity: days > 3 ? 0 : 1 });
    });
    const incomplete = catalogItems.filter(i => !i.description?.trim() || i.basePrice <= 0 || !i.categoryId);
    if (incomplete.length > 0) items.push({ id: "cat-inc", label: `${incomplete.length} ${t("catalogItems").toLowerCase()}`, detail: t("missingFields", { count: String(incomplete.length) }), href: "/catalog", severity: incomplete.length > 5 ? 0 : 2 });
    const oldDrafts = filteredOffers.filter(o => o.status === "DRAFT" && (Date.now() - new Date(o.createdAt).getTime()) > 7 * 86400000);
    if (oldDrafts.length > 0) items.push({ id: "drafts", label: `${oldDrafts.length} ${t("drafts").toLowerCase()}`, detail: "> 7j", href: "/offers", severity: 2 });
    return items.sort((a, b) => a.severity - b.severity);
  }, [filteredOffers, catalogItems, t]);

  const avgQualityScore = useMemo(() => {
    const scored = filteredOffers.filter(o => o.qualityScore > 0);
    if (!scored.length) return 0;
    return Math.round(scored.reduce((sum, o) => sum + o.qualityScore, 0) / scored.length);
  }, [filteredOffers]);

  const unreadNotifications = useMemo(() => notifications.filter(n => !n.read).length, [notifications]);
  const activeRules = useMemo(() => rules.filter(r => r.active).length, [rules]);
  const userRoles = useMemo(() => {
    const counts: Record<string, number> = {};
    users.forEach(u => (counts[u.role] = (counts[u.role] || 0) + 1));
    return Object.entries(counts).sort(([, a], [, b]) => b - a).slice(0, 3);
  }, [users]);

  const summaryText = useMemo(() => {
    const parts: string[] = [];
    const pending = filteredOffers.filter(o => o.status === "IN_VALIDATION").length;
    if (pending > 0) parts.push(t("summaryPending", { count: String(pending) }));
    if (catalogHealth.overall > 0 && catalogHealth.overall < 100) parts.push(t("summaryCatalogHealth", { percent: String(catalogHealth.overall) }));
    if (unreadNotifications > 0) parts.push(t("summaryNotifications", { count: String(unreadNotifications) }));
    if (!parts.length) parts.push(t("summaryAllGood"));
    return parts.join(" · ");
  }, [filteredOffers, catalogHealth, unreadNotifications, t]);

  const hour = new Date().getHours();
  const greeting = hour < 12 ? t("greeting_morning") : hour < 18 ? t("greeting_afternoon") : t("greeting_evening");

  function timeAgo(dateStr: string) {
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 60) return `${mins}min`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h`;
    return `${Math.floor(hrs / 24)}j`;
  }

  const gridStroke = isDark ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.04)";
  const axisFill = isDark ? "#525252" : "#a3a3a3";
  const SEVERITY_DOT = ["bg-red-500", "bg-amber-400", "bg-neutral-300 dark:bg-neutral-600"];

  /* ════════════════════════════════════════════════ */
  return (
    <div className="flex flex-col gap-6 max-w-[1360px] mx-auto pb-10">

      {/* ═══ GREETING ═══ */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold tracking-tight text-neutral-900 dark:text-white">{greeting}, {user?.firstName}</h2>
          <p className="text-[13px] text-neutral-500 dark:text-neutral-500 mt-0.5">
            {loading ? <Skeleton className="w-52 h-4" /> : summaryText}
          </p>
        </div>
        <Link href="/offers" className="primary-icon !rounded-lg !px-3 !py-1.5 !gap-1.5">
          <svg className="size-3.5" viewBox="0 0 20 20" fill="none" stroke="white" strokeWidth="1.5" strokeLinecap="round"><path d="M10 3v14M3 10h14" /></svg>
          <span className="hidden lg:inline text-xs font-medium">{t("createOffer")}</span>
        </Link>
      </div>

      {/* ═══ FILTERS ═══ */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="flex h-8 rounded-lg bg-neutral-100 dark:bg-white/[0.04] p-0.5 w-fit">
          {(["all", "7d", "30d", "90d"] as const).map(p => (
            <button key={p} onClick={() => setPeriodFilter(p)}
              className={`px-3 rounded-md text-[12px] font-medium transition-all ${periodFilter === p ? "bg-white dark:bg-white/[0.1] text-neutral-900 dark:text-white shadow-sm" : "text-neutral-500 dark:text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-300"}`}>
              {p === "all" ? t("filterAll") : t(`period${p}`)}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          {isFiltered && (
            <button onClick={() => { setPeriodFilter("all"); setStatusFilter("ALL"); }}
              className="flex items-center gap-1 h-8 px-2.5 rounded-lg text-[12px] font-medium text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors">
              <svg className="size-3.5" viewBox="0 0 20 20" fill="none"><path d="M6 6l8 8M14 6l-8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" /></svg>
              {t("filterReset")}
            </button>
          )}
          <div className="relative">
            <select
              value={statusFilter}
              onChange={e => setStatusFilter(e.target.value)}
              className="appearance-none h-8 pl-3 pr-8 rounded-lg text-[12px] font-medium bg-white dark:bg-white/[0.04] ring-1 ring-neutral-200/80 dark:ring-white/[0.08] text-neutral-700 dark:text-neutral-300 outline-none cursor-pointer hover:ring-neutral-300 dark:hover:ring-white/[0.12] transition-all"
            >
              <option value="ALL">{t("filterAllStatuses")}</option>
              {allStatuses.map(s => (
                <option key={s} value={s}>{ts.has(s) ? ts(s) : s}</option>
              ))}
            </select>
            <svg className="absolute right-2 top-1/2 -translate-y-1/2 size-3.5 text-neutral-400 pointer-events-none" viewBox="0 0 20 20" fill="none"><path d="M6 8l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
          </div>
        </div>
      </div>

      {/* ═══ KPIs ═══ */}
      <div className="grid grid-cols-2 xl:grid-cols-5 gap-4">
        {/* Catalog */}
        <div className="surface p-5 flex flex-col justify-between">
          <p className="text-xs font-medium text-neutral-500 dark:text-neutral-400">{t("catalogItems")}</p>
          <div className="mt-3 flex items-end justify-between gap-3">
            <span className="text-[30px] font-semibold tracking-tight text-neutral-900 dark:text-white tabular-nums leading-none">
              {loading ? <Skeleton className="w-10 h-7" /> : catalogItems.length}
            </span>
            {!loading && (
              <div className="flex items-center gap-2 pb-1">
                <div className="w-16"><ProgressBar value={catalogHealth.overall} color="bg-blue-500" /></div>
                <span className="text-[11px] font-medium text-neutral-500 dark:text-neutral-400 tabular-nums">{catalogHealth.overall}%</span>
              </div>
            )}
          </div>
        </div>
        {/* Offres */}
        <div className="surface p-5 flex flex-col justify-between">
          <p className="text-xs font-medium text-neutral-500 dark:text-neutral-400">{t("activeOffers")}</p>
          <div className="mt-3 flex items-end justify-between gap-3">
            <span className="text-[30px] font-semibold tracking-tight text-neutral-900 dark:text-white tabular-nums leading-none">
              {loading ? <Skeleton className="w-10 h-7" /> : filteredOffers.filter(o => o.status === "PUBLISHED").length}
            </span>
            {!loading && <Sparkline data={sparklineData} className="w-20 h-8 text-emerald-500 pb-1" />}
          </div>
        </div>
        {/* Campagnes */}
        <div className="surface p-5 flex flex-col justify-between">
          <p className="text-xs font-medium text-neutral-500 dark:text-neutral-400">{t("activeCampaigns")}</p>
          <div className="mt-3 flex items-end justify-between gap-3">
            <span className="text-[30px] font-semibold tracking-tight text-neutral-900 dark:text-white tabular-nums leading-none">
              {loading ? <Skeleton className="w-10 h-7" /> : activeCampaigns.length}
            </span>
            {!loading && channelTypes.length > 0 && (
              <p className="text-[11px] text-neutral-400 dark:text-neutral-500 pb-1 truncate">{channelTypes.join(" · ")}</p>
            )}
          </div>
        </div>
        {/* Enrichissement */}
        <div className="surface p-5 flex flex-col justify-between">
          <p className="text-xs font-medium text-neutral-500 dark:text-neutral-400">{t("enrichmentRate")}</p>
          <div className="mt-3">
            <span className="text-[30px] font-semibold tracking-tight text-neutral-900 dark:text-white tabular-nums leading-none">
              {loading ? <Skeleton className="w-10 h-7" /> : `${enrichmentRate}%`}
            </span>
            {!loading && <div className="mt-3"><ProgressBar value={enrichmentRate} color="bg-amber-500" /></div>}
          </div>
        </div>
        {/* Quality Score */}
        <div className="surface p-5 flex flex-col justify-between">
          <p className="text-xs font-medium text-neutral-500 dark:text-neutral-400">{t("qualityScore")}</p>
          <div className="mt-3">
            <span className="text-[30px] font-semibold tracking-tight text-neutral-900 dark:text-white tabular-nums leading-none">
              {loading ? <Skeleton className="w-10 h-7" /> : avgQualityScore > 0 ? `${avgQualityScore}/100` : <span className="text-neutral-300 dark:text-neutral-600 text-lg">·</span>}
            </span>
            {!loading && avgQualityScore > 0 && (
              <div className="mt-3"><ProgressBar value={avgQualityScore} color={avgQualityScore >= 70 ? "bg-emerald-500" : avgQualityScore >= 40 ? "bg-amber-500" : "bg-red-500"} /></div>
            )}
          </div>
        </div>
      </div>

      {/* ═══ PIPELINE ═══ */}
      {!loading && totalPipeline > 0 && (
        <div className="flex items-center gap-4">
          <div className="flex h-[6px] flex-1 rounded-full overflow-hidden gap-[1px]">
            {PIPELINE.map(s => {
              const count = pipelineCounts[s.key] || 0;
              if (!count) return null;
              return <div key={s.key} className={`${s.tw} first:rounded-l-full last:rounded-r-full transition-all duration-500`} style={{ width: `${(count / totalPipeline) * 100}%` }} title={`${ts.has(s.key) ? ts(s.key) : s.key}: ${count}`} />;
            })}
          </div>
          <span className="text-[11px] text-neutral-400 dark:text-neutral-500 tabular-nums shrink-0">{totalPipeline + archivedCount} {t("totalOffers").toLowerCase()}</span>
        </div>
      )}

      {/* ═══ CHARTS ═══ */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
        {/* Activity chart */}
        <div className="surface lg:col-span-3">
          <div className="flex items-center justify-between px-5 pt-5">
            <p className="text-[13px] font-medium text-neutral-900 dark:text-white">{t("offerActivity")}</p>
            <div className="flex items-center gap-2">
              <ChartTypeSwitcher types={["area", "bar", "line"]} active={activityChartType} onChange={setActivityChartType} />
              <div className="flex h-7 rounded-lg bg-neutral-100 dark:bg-white/[0.04] p-0.5">
                {(["7d", "30d", "90d"] as const).map(p => (
                  <button key={p} onClick={() => setChartPeriod(p)}
                    className={`px-2.5 rounded-md text-[11px] font-medium transition-all ${chartPeriod === p ? "bg-white dark:bg-white/[0.1] text-neutral-900 dark:text-white shadow-sm" : "text-neutral-500 dark:text-neutral-400"}`}>
                    {t(`period${p}`)}
                  </button>
                ))}
              </div>
            </div>
          </div>
          <div className="px-2 pb-3 pt-3">
            {loading ? <Skeleton className="w-full h-[200px] mx-3" /> : (
              <ResponsiveContainer width="100%" height={200}>
                {activityChartType === "area" ? (
                  <AreaChart data={offerActivityData} margin={{ top: 4, right: 12, left: -24, bottom: 0 }}>
                    <defs>
                      <linearGradient id="gBlue" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#3b82f6" stopOpacity={0.12} /><stop offset="100%" stopColor="#3b82f6" stopOpacity={0} /></linearGradient>
                      <linearGradient id="gTeal" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#14b8a6" stopOpacity={0.12} /><stop offset="100%" stopColor="#14b8a6" stopOpacity={0} /></linearGradient>
                    </defs>
                    <XAxis dataKey="name" tick={{ fontSize: 11, fill: axisFill }} axisLine={false} tickLine={false} dy={4} />
                    <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: axisFill }} axisLine={false} tickLine={false} />
                    <Tooltip content={<ChartTooltip />} />
                    <Area type="monotone" dataKey={t("created")} stroke="#3b82f6" strokeWidth={2} fill="url(#gBlue)" dot={false} activeDot={{ r: 4, strokeWidth: 2, stroke: isDark ? "#161616" : "#fff", fill: "#3b82f6" }} />
                    <Area type="monotone" dataKey={t("published")} stroke="#14b8a6" strokeWidth={2} fill="url(#gTeal)" dot={false} activeDot={{ r: 4, strokeWidth: 2, stroke: isDark ? "#161616" : "#fff", fill: "#14b8a6" }} />
                  </AreaChart>
                ) : activityChartType === "bar" ? (
                  <BarChart data={offerActivityData} margin={{ top: 4, right: 12, left: -24, bottom: 0 }}>
                    <XAxis dataKey="name" tick={{ fontSize: 11, fill: axisFill }} axisLine={false} tickLine={false} dy={4} />
                    <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: axisFill }} axisLine={false} tickLine={false} />
                    <Tooltip content={<ChartTooltip />} />
                    <Bar dataKey={t("created")} fill="#3b82f6" radius={[3, 3, 0, 0]} barSize={14} opacity={0.85} />
                    <Bar dataKey={t("published")} fill="#14b8a6" radius={[3, 3, 0, 0]} barSize={14} opacity={0.85} />
                  </BarChart>
                ) : (
                  <LineChart data={offerActivityData} margin={{ top: 4, right: 12, left: -24, bottom: 0 }}>
                    <XAxis dataKey="name" tick={{ fontSize: 11, fill: axisFill }} axisLine={false} tickLine={false} dy={4} />
                    <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: axisFill }} axisLine={false} tickLine={false} />
                    <Tooltip content={<ChartTooltip />} />
                    <Line type="monotone" dataKey={t("created")} stroke="#3b82f6" strokeWidth={2} dot={{ r: 3, strokeWidth: 2, stroke: isDark ? "#161616" : "#fff", fill: "#3b82f6" }} activeDot={{ r: 5, strokeWidth: 2, stroke: isDark ? "#161616" : "#fff", fill: "#3b82f6" }} />
                    <Line type="monotone" dataKey={t("published")} stroke="#14b8a6" strokeWidth={2} dot={{ r: 3, strokeWidth: 2, stroke: isDark ? "#161616" : "#fff", fill: "#14b8a6" }} activeDot={{ r: 5, strokeWidth: 2, stroke: isDark ? "#161616" : "#fff", fill: "#14b8a6" }} />
                  </LineChart>
                )}
              </ResponsiveContainer>
            )}
            {!loading && (
              <div className="flex items-center gap-4 mt-1 px-4">
                <span className="flex items-center gap-1.5 text-[11px] text-neutral-500 dark:text-neutral-400"><span className="size-[6px] rounded-full bg-blue-500" />{t("created")}</span>
                <span className="flex items-center gap-1.5 text-[11px] text-neutral-500 dark:text-neutral-400"><span className="size-[6px] rounded-full bg-teal-500" />{t("published")}</span>
              </div>
            )}
          </div>
        </div>

        {/* Status distribution */}
        <div className="surface lg:col-span-2 flex flex-col">
          <div className="flex items-center justify-between px-5 pt-5">
            <p className="text-[13px] font-medium text-neutral-900 dark:text-white">{t("statusDistribution")}</p>
            <ChartTypeSwitcher types={["donut", "bar", "radar"]} active={statusChartType} onChange={setStatusChartType} />
          </div>
          <div className="flex-1 flex flex-col items-center justify-center px-5 pb-4">
            {loading ? <Skeleton className="size-[150px] rounded-full" /> : statusDistribution.length === 0 ? (
              <p className="text-[13px] text-neutral-400">{t("noOffers")}</p>
            ) : statusChartType === "donut" ? (
              <>
                <div className="relative">
                  <ResponsiveContainer width={160} height={160}>
                    <PieChart>
                      <Pie data={statusDistribution} cx="50%" cy="50%" innerRadius={48} outerRadius={72} paddingAngle={2} dataKey="value" stroke="none">
                        {statusDistribution.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                      </Pie>
                      <Tooltip content={<ChartTooltip />} />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                    <span className="text-lg font-semibold text-neutral-900 dark:text-white tabular-nums">{filteredOffers.length}</span>
                    <span className="text-[10px] text-neutral-400">{t("totalOffers").toLowerCase()}</span>
                  </div>
                </div>
                <div className="flex flex-wrap gap-x-3 gap-y-1 mt-1 justify-center">
                  {statusDistribution.map((s, i) => (
                    <span key={i} className="flex items-center gap-1 text-[10px] text-neutral-500 dark:text-neutral-400"><span className="size-[5px] rounded-full shrink-0" style={{ background: s.color }} />{s.name}</span>
                  ))}
                </div>
              </>
            ) : statusChartType === "bar" ? (
              <div className="w-full pt-2">
                <div className="space-y-2.5">
                  {statusDistribution.map((s, i) => {
                    const maxVal = Math.max(...statusDistribution.map(d => d.value));
                    return (
                      <div key={i} className="flex items-center gap-3">
                        <span className="text-[11px] text-neutral-500 dark:text-neutral-400 w-20 truncate text-right">{s.name}</span>
                        <div className="flex-1 h-[18px] rounded bg-neutral-100 dark:bg-white/[0.04] overflow-hidden">
                          <div
                            className="h-full rounded transition-all duration-500"
                            style={{ width: `${(s.value / maxVal) * 100}%`, background: s.color }}
                          />
                        </div>
                        <span className="text-[11px] font-semibold text-neutral-900 dark:text-white tabular-nums w-6 text-right">{s.value}</span>
                      </div>
                    );
                  })}
                </div>
                <div className="flex items-center justify-center gap-1.5 mt-3 pt-2 border-t border-neutral-100 dark:border-white/[0.04]">
                  <span className="text-[12px] font-semibold text-neutral-900 dark:text-white tabular-nums">{filteredOffers.length}</span>
                  <span className="text-[11px] text-neutral-400">{t("totalOffers").toLowerCase()}</span>
                </div>
              </div>
            ) : (
              <>
                <ResponsiveContainer width={180} height={180}>
                  <RadarChart data={statusDistribution}>
                    <PolarGrid stroke={isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.06)"} />
                    <PolarAngleAxis dataKey="name" tick={{ fontSize: 9, fill: axisFill }} />
                    <Radar dataKey="value" stroke="#3b82f6" fill="#3b82f6" fillOpacity={0.15} strokeWidth={1.5} dot={{ r: 2.5, fill: "#3b82f6", stroke: isDark ? "#161616" : "#fff", strokeWidth: 1.5 }} />
                    <Tooltip content={<ChartTooltip />} />
                  </RadarChart>
                </ResponsiveContainer>
                <div className="flex items-center gap-1.5 mt-1">
                  <span className="text-[12px] font-semibold text-neutral-900 dark:text-white tabular-nums">{filteredOffers.length}</span>
                  <span className="text-[11px] text-neutral-400">{t("totalOffers").toLowerCase()}</span>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* ═══ PLATFORM MODULES ═══ */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
        {/* Users */}
        <Link href="/users" className="surface p-5 group hover:ring-1 hover:ring-neutral-200/60 dark:hover:ring-white/[0.08] transition-all">
          <div className="flex items-center justify-between mb-3">
            <div className="size-8 rounded-lg bg-blue-50 dark:bg-blue-500/10 flex items-center justify-center">
              <svg className="size-4 text-blue-500" viewBox="0 0 20 20" fill="none"><circle cx="10" cy="7" r="3.5" stroke="currentColor" strokeWidth="1.5" /><path d="M3 18c0-3.3 3.1-6 7-6s7 2.7 7 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" /></svg>
            </div>
            <svg className="size-3.5 text-neutral-300 dark:text-neutral-600 opacity-0 group-hover:opacity-100 transition-opacity" viewBox="0 0 20 20" fill="none"><path d="M7 4l6 6-6 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
          </div>
          <p className="text-[13px] font-medium text-neutral-900 dark:text-white">{t("users")}</p>
          <div className="flex items-center gap-2 mt-1">
            <span className="text-xl font-semibold text-neutral-900 dark:text-white tabular-nums">
              {loading ? <Skeleton className="w-6 h-5" /> : users.length}
            </span>
            {!loading && userRoles.length > 0 && (
              <span className="text-[11px] text-neutral-400 dark:text-neutral-500 truncate">
                {userRoles.map(([role, count]) => `${count} ${role.toLowerCase().replace(/_/g, " ")}`).join(" · ")}
              </span>
            )}
          </div>
        </Link>

        {/* Media */}
        <Link href="/media" className="surface p-5 group hover:ring-1 hover:ring-neutral-200/60 dark:hover:ring-white/[0.08] transition-all">
          <div className="flex items-center justify-between mb-3">
            <div className="size-8 rounded-lg bg-violet-50 dark:bg-violet-500/10 flex items-center justify-center">
              <svg className="size-4 text-violet-500" viewBox="0 0 20 20" fill="none"><rect x="2" y="3" width="16" height="14" rx="2" stroke="currentColor" strokeWidth="1.5" /><circle cx="7" cy="8" r="1.5" stroke="currentColor" strokeWidth="1.2" /><path d="M2 14l4-3.5 3 2.5 4-4 5 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
            </div>
            <svg className="size-3.5 text-neutral-300 dark:text-neutral-600 opacity-0 group-hover:opacity-100 transition-opacity" viewBox="0 0 20 20" fill="none"><path d="M7 4l6 6-6 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
          </div>
          <p className="text-[13px] font-medium text-neutral-900 dark:text-white">{t("media")}</p>
          <div className="flex items-center gap-2 mt-1">
            <span className="text-xl font-semibold text-neutral-900 dark:text-white tabular-nums">
              {loading ? <Skeleton className="w-6 h-5" /> : mediaCount}
            </span>
            <span className="text-[11px] text-neutral-400 dark:text-neutral-500">{t("mediaFiles")}</span>
          </div>
        </Link>

        {/* Business Rules */}
        <Link href="/rules" className="surface p-5 group hover:ring-1 hover:ring-neutral-200/60 dark:hover:ring-white/[0.08] transition-all">
          <div className="flex items-center justify-between mb-3">
            <div className="size-8 rounded-lg bg-amber-50 dark:bg-amber-500/10 flex items-center justify-center">
              <svg className="size-4 text-amber-500" viewBox="0 0 20 20" fill="none"><path d="M3 4h14M3 8h10M3 12h14M3 16h8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" /><circle cx="16" cy="14" r="2.5" stroke="currentColor" strokeWidth="1.5" /></svg>
            </div>
            <svg className="size-3.5 text-neutral-300 dark:text-neutral-600 opacity-0 group-hover:opacity-100 transition-opacity" viewBox="0 0 20 20" fill="none"><path d="M7 4l6 6-6 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
          </div>
          <p className="text-[13px] font-medium text-neutral-900 dark:text-white">{t("businessRules")}</p>
          <div className="flex items-center gap-2 mt-1">
            <span className="text-xl font-semibold text-neutral-900 dark:text-white tabular-nums">
              {loading ? <Skeleton className="w-6 h-5" /> : rules.length}
            </span>
            {!loading && activeRules > 0 && (
              <span className="text-[11px] text-neutral-400 dark:text-neutral-500">{activeRules} {t("activeRulesLabel")}</span>
            )}
          </div>
        </Link>

        {/* Notifications */}
        <Link href="/notifications" className="surface p-5 group hover:ring-1 hover:ring-neutral-200/60 dark:hover:ring-white/[0.08] transition-all">
          <div className="flex items-center justify-between mb-3">
            <div className="relative size-8 rounded-lg bg-rose-50 dark:bg-rose-500/10 flex items-center justify-center">
              <svg className="size-4 text-rose-500" viewBox="0 0 20 20" fill="none"><path d="M10 2a5 5 0 00-5 5c0 3.5-1.5 5.5-2 6h14c-.5-.5-2-2.5-2-6a5 5 0 00-5-5z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" /><path d="M8 15a2 2 0 004 0" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" /></svg>
              {!loading && unreadNotifications > 0 && (
                <span className="absolute -top-1 -right-1 min-w-4 h-4 rounded-full bg-red-500 text-white text-[9px] font-bold flex items-center justify-center px-1">{unreadNotifications}</span>
              )}
            </div>
            <svg className="size-3.5 text-neutral-300 dark:text-neutral-600 opacity-0 group-hover:opacity-100 transition-opacity" viewBox="0 0 20 20" fill="none"><path d="M7 4l6 6-6 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
          </div>
          <p className="text-[13px] font-medium text-neutral-900 dark:text-white">{t("notificationsLabel")}</p>
          <div className="flex items-center gap-2 mt-1">
            <span className="text-xl font-semibold text-neutral-900 dark:text-white tabular-nums">
              {loading ? <Skeleton className="w-6 h-5" /> : notifications.length}
            </span>
            {!loading && unreadNotifications > 0 && (
              <span className="text-[11px] font-medium text-red-500">{unreadNotifications} {t("unread")}</span>
            )}
          </div>
        </Link>
      </div>

      {/* ═══ CATALOG HEALTH + CHANNELS + ACTION CENTER ═══ */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Catalog Health */}
        <div className="surface p-5">
          <p className="text-[13px] font-medium text-neutral-900 dark:text-white mb-5">{t("catalogHealth")}</p>
          {loading ? <div className="space-y-5">{Array.from({ length: 3 }, (_, i) => <Skeleton key={i} className="w-full h-4" />)}</div> : catalogItems.length === 0 ? (
            <p className="text-[13px] text-neutral-400">{t("noOffers")}</p>
          ) : (
            <div className="space-y-5">
              {[
                { label: t("withDescription"), value: catalogHealth.withDesc, color: "bg-emerald-500" },
                { label: t("withPrice"), value: catalogHealth.withPrice, color: "bg-blue-500" },
                { label: t("withCategory"), value: catalogHealth.withCat, color: "bg-violet-500" },
              ].map(r => (
                <div key={r.label}>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[12px] text-neutral-600 dark:text-neutral-400">{r.label}</span>
                    <span className="text-[12px] font-semibold text-neutral-900 dark:text-white tabular-nums">{r.value}%</span>
                  </div>
                  <ProgressBar value={r.value} color={r.color} />
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Channels */}
        <div className="surface p-5">
          <p className="text-[13px] font-medium text-neutral-900 dark:text-white mb-5">{t("channelDistribution")}</p>
          {loading ? <Skeleton className="w-full h-[130px]" /> : channelDistribution.length === 0 ? (
            <div className="flex items-center justify-center h-[130px]"><p className="text-[13px] text-neutral-400">{t("noActivity")}</p></div>
          ) : (
            <ResponsiveContainer width="100%" height={130}>
              <BarChart data={channelDistribution} layout="vertical" margin={{ top: 0, right: 0, left: -12, bottom: 0 }}>
                <XAxis type="number" hide />
                <YAxis type="category" dataKey="name" tick={{ fontSize: 11, fill: axisFill }} axisLine={false} tickLine={false} width={85} />
                <Tooltip content={<ChartTooltip />} />
                <Bar dataKey="value" radius={[0, 4, 4, 0]} barSize={12}>
                  {channelDistribution.map((e, i) => <Cell key={i} fill={e.fill} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Action Center */}
        <div className="surface flex flex-col overflow-hidden">
          <div className="flex items-center justify-between px-5 pt-5 pb-3">
            <p className="text-[13px] font-medium text-neutral-900 dark:text-white">{t("actionCenter")}</p>
            {!loading && actionItems.length > 0 && <span className="min-w-5 h-5 rounded-full bg-red-500 text-white text-[10px] font-semibold flex items-center justify-center px-1.5">{actionItems.length}</span>}
          </div>
          <div className="flex-1">
            {loading ? (
              <div className="px-5 pb-5 space-y-3">{Array.from({ length: 3 }, (_, i) => <Skeleton key={i} className="w-full h-9" />)}</div>
            ) : actionItems.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full pb-5">
                <svg className="size-7 text-emerald-500/30 mb-1.5" viewBox="0 0 20 20" fill="none"><circle cx="10" cy="10" r="7" stroke="currentColor" strokeWidth="1.5" /><path d="M7 10l2 2 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
                <p className="text-[12px] text-neutral-400">{t("actionCenterEmpty")}</p>
              </div>
            ) : actionItems.map(item => (
              <Link key={item.id} href={item.href} className="flex items-center gap-3 px-5 py-2.5 hover:bg-neutral-50 dark:hover:bg-white/[0.02] transition-colors group">
                <span className={`size-[7px] rounded-full shrink-0 ${SEVERITY_DOT[item.severity]}`} />
                <div className="flex-1 min-w-0">
                  <p className="text-[13px] text-neutral-800 dark:text-neutral-200 truncate">{item.label}</p>
                  <p className="text-[11px] text-neutral-400">{item.detail}</p>
                </div>
                <svg className="size-3.5 text-neutral-300 dark:text-neutral-600 opacity-0 group-hover:opacity-100 transition-opacity shrink-0" viewBox="0 0 20 20" fill="none"><path d="M7 4l6 6-6 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
              </Link>
            ))}
          </div>
        </div>
      </div>

      {/* ═══ RECENT OFFERS + ACTIVITY ═══ */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
        {/* Recent Offers */}
        <div className="surface lg:col-span-3 overflow-hidden">
          <div className="flex items-center justify-between px-5 pt-5 pb-3">
            <p className="text-[13px] font-medium text-neutral-900 dark:text-white">{t("recentOffers")}</p>
            <Link href="/offers" className="text-[12px] font-medium text-primary hover:text-primary-light transition-colors">{t("viewAll")}</Link>
          </div>
          {loading ? (
            <div className="px-5 pb-5 space-y-3">{Array.from({ length: 4 }, (_, i) => <Skeleton key={i} className="w-full h-10" />)}</div>
          ) : filteredOffers.length === 0 ? (
            <div className="py-10 text-center"><p className="text-[13px] text-neutral-400">{t("noOffers")}</p></div>
          ) : filteredOffers.slice(0, 5).map((offer, i) => (
            <div key={offer.id} className={`flex items-center justify-between px-5 py-3 hover:bg-neutral-50 dark:hover:bg-white/[0.02] transition-colors ${i > 0 ? "border-t border-neutral-100 dark:border-white/[0.04]" : ""}`}>
              <div className="min-w-0 flex-1 mr-4">
                <p className="text-[13px] font-medium text-neutral-900 dark:text-white truncate">{offer.name}</p>
                <p className="text-[11px] text-neutral-400 truncate mt-0.5">{offer.shortDescription}</p>
              </div>
              <span className="flex items-center gap-1.5 shrink-0">
                <span className="size-[6px] rounded-full shrink-0" style={{ background: STATUS_HEX[offer.status] || "#94a3b8" }} />
                <span className="text-[11px] font-medium text-neutral-500 dark:text-neutral-400">{ts.has(offer.status) ? ts(offer.status) : offer.status}</span>
              </span>
            </div>
          ))}
        </div>

        {/* Activity Feed */}
        <div className="surface lg:col-span-2 overflow-hidden">
          <div className="px-5 pt-5 pb-3">
            <p className="text-[13px] font-medium text-neutral-900 dark:text-white">{t("recentActivity")}</p>
          </div>
          {loading ? (
            <div className="px-5 pb-5 space-y-3">{Array.from({ length: 5 }, (_, i) => <Skeleton key={i} className="w-full h-7" />)}</div>
          ) : auditLogs.length === 0 ? (
            <div className="py-10 text-center"><p className="text-[13px] text-neutral-400">{t("noActivity")}</p></div>
          ) : auditLogs.map((log, i) => (
            <div key={log.id || i} className={`flex items-center gap-3 px-5 py-2.5 hover:bg-neutral-50 dark:hover:bg-white/[0.02] transition-colors ${i > 0 ? "border-t border-neutral-100 dark:border-white/[0.04]" : ""}`}>
              <div className="size-6 rounded-full bg-neutral-100 dark:bg-white/[0.06] flex items-center justify-center shrink-0">
                <svg className="size-3 text-neutral-400" viewBox="0 0 20 20" fill="none"><circle cx="10" cy="7" r="3" stroke="currentColor" strokeWidth="1.5" /><path d="M4 17c0-3 2.7-5 6-5s6 2 6 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" /></svg>
              </div>
              <p className="flex-1 min-w-0 text-[12px] text-neutral-600 dark:text-neutral-300 truncate">
                <span className="font-medium text-neutral-800 dark:text-neutral-200">{log.action?.toLowerCase()}</span>{" "}{log.entityType?.toLowerCase()}
              </p>
              <span className="text-[10px] text-neutral-400 tabular-nums shrink-0">{timeAgo(log.createdAt)}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
