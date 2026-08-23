"use client";

import { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import { useAuth } from "@/lib/auth";
import api from "@/lib/api";
import type { Offer } from "@/lib/types";
import { useTranslations } from "next-intl";

interface Stats {
  totalOffers: number;
  publishedOffers: number;
  draftOffers: number;
  catalogItems: number;
  totalUsers: number;
  activeCampaigns: number;
  inEnrichment: number;
  inValidation: number;
}

const STATUS_COLORS: Record<string, string> = {
  PUBLISHED: "#22c55e",
  DRAFT: "#a3a3a3",
  IN_ENRICHMENT: "#3b82f6",
  IN_VALIDATION: "#eab308",
};

const STATUS_ICON_STYLES: Record<string, string> = {
  PUBLISHED: "bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400",
  DRAFT: "bg-neutral-100 text-neutral-500 dark:bg-neutral-800 dark:text-neutral-400",
  IN_ENRICHMENT: "bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400",
  IN_VALIDATION: "bg-amber-100 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400",
  PLANNED: "bg-purple-100 text-purple-600 dark:bg-purple-900/30 dark:text-purple-400",
  SUSPENDED: "bg-orange-100 text-orange-600 dark:bg-orange-900/30 dark:text-orange-400",
  ARCHIVED: "bg-neutral-100 text-neutral-400 dark:bg-neutral-800 dark:text-neutral-500",
};

/* ===== COMPOSANTS INTERNES ===== */

function DonutChart({ segments, total }: { segments: { label: string; value: number; color: string }[]; total: number }) {
  const size = 160;
  const strokeWidth = 28;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const gap = 0.008;

  let offset = 0;
  const filtered = segments.filter(s => s.value > 0);
  const arcs = filtered.map((seg, i) => {
    const pct = total > 0 ? seg.value / total : 0;
    const actualPct = filtered.length > 1 ? Math.max(0, pct - gap) : pct;
    const dashArray = `${actualPct * circumference} ${circumference}`;
    const dashOffset = -offset * circumference;
    offset += pct;
    return { ...seg, dashArray, dashOffset, index: i };
  });

  return (
    <div className="relative inline-flex items-center justify-center shrink-0">
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="currentColor" strokeWidth={strokeWidth} className="text-neutral-100 dark:text-neutral-800" />
        {arcs.map((arc) => (
          <circle
            key={arc.index}
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke={arc.color}
            strokeWidth={strokeWidth}
            strokeDasharray={arc.dashArray}
            strokeDashoffset={arc.dashOffset}
            strokeLinecap="round"
            className="transition-all duration-1000 ease-out"
          />
        ))}
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-[10px] font-medium text-text-secondary dark:text-neutral-500 uppercase tracking-wider">Total</span>
        <span className="text-2xl font-bold text-black dark:text-white tabular-nums">{total}</span>
      </div>
    </div>
  );
}

function ProgressBar({ value, max, color }: { value: number; max: number; color: string }) {
  const pct = max > 0 ? Math.min((value / max) * 100, 100) : 0;
  return (
    <div className="h-1.5 w-full rounded-full bg-neutral-100 dark:bg-neutral-800 overflow-hidden">
      <div className="h-full rounded-full transition-all duration-1000 ease-out" style={{ width: `${pct}%`, backgroundColor: color }} />
    </div>
  );
}

function StatusIcon({ status }: { status: string }) {
  const icons: Record<string, React.ReactNode> = {
    PUBLISHED: (
      <svg className="size-4" viewBox="0 0 20 20" fill="none">
        <circle cx="10" cy="10" r="7" stroke="currentColor" strokeWidth="1.5" />
        <path d="M7 10l2 2 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
    DRAFT: (
      <svg className="size-4" viewBox="0 0 20 20" fill="none">
        <rect x="3" y="2" width="14" height="16" rx="2" stroke="currentColor" strokeWidth="1.5" />
        <path d="M7 7h6M7 10.5h4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      </svg>
    ),
    IN_ENRICHMENT: (
      <svg className="size-4" viewBox="0 0 20 20" fill="none">
        <path d="M10 2v4M10 14v4M2 10h4M14 10h4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        <circle cx="10" cy="10" r="3" stroke="currentColor" strokeWidth="1.5" />
      </svg>
    ),
    IN_VALIDATION: (
      <svg className="size-4" viewBox="0 0 20 20" fill="none">
        <path d="M10 2l1.5 3 3.5.5-2.5 2.4.6 3.1L10 9.5 6.9 11l.6-3.1L5 5.5l3.5-.5L10 2z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
      </svg>
    ),
  };
  return (
    <div className={`size-9 rounded-xl flex items-center justify-center shrink-0 ${STATUS_ICON_STYLES[status] ?? STATUS_ICON_STYLES.DRAFT}`}>
      {icons[status] ?? icons.DRAFT}
    </div>
  );
}

function Skeleton({ className }: { className: string }) {
  return <div className={`rounded-lg bg-neutral-100 dark:bg-neutral-800 animate-pulse ${className}`} />;
}

/* ===== PAGE ===== */

export default function DashboardPage() {
  const { user } = useAuth();
  const t = useTranslations("dashboard");
  const ts = useTranslations("offers.status");
  const tc = useTranslations("common");
  const [stats, setStats] = useState<Stats>({
    totalOffers: 0,
    publishedOffers: 0,
    draftOffers: 0,
    catalogItems: 0,
    totalUsers: 0,
    activeCampaigns: 0,
    inEnrichment: 0,
    inValidation: 0,
  });
  const [recentOffers, setRecentOffers] = useState<Offer[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const [offersRes, catalogRes, usersRes, campaignsRes] = await Promise.all([
          api.get("/offers").catch(() => ({ data: [] })),
          api.get("/catalog").catch(() => ({ data: [] })),
          api.get("/users").catch(() => ({ data: [] })),
          api.get("/campaigns/mine").catch(() => ({ data: [] })),
        ]);

        // /offers et /catalog renvoient des Page<> ; /users et /campaigns/mine des tableaux nus.
        const offers: Offer[] = offersRes.data.content ?? offersRes.data;
        const catalogItems = catalogRes.data.content ?? catalogRes.data;
        setStats({
          totalOffers: offers.length,
          publishedOffers: offers.filter((o) => o.status === "PUBLISHED").length,
          draftOffers: offers.filter((o) => o.status === "DRAFT").length,
          catalogItems: catalogItems.length,
          totalUsers: usersRes.data.length,
          activeCampaigns: campaignsRes.data.filter((c: { status: string }) => c.status === "PUBLISHED" || c.status === "SCHEDULED").length,
          inEnrichment: offers.filter((o) => o.status === "IN_ENRICHMENT").length,
          inValidation: offers.filter((o) => o.status === "IN_VALIDATION").length,
        });
        setRecentOffers(offers.slice(0, 5));
      } catch {
        /* API pas disponible */
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const hour = new Date().getHours();
  const greeting =
    hour < 12 ? t("greeting_morning") : hour < 18 ? t("greeting_afternoon") : t("greeting_evening");

  const donutSegments = useMemo(() => [
    { label: ts.has("PUBLISHED") ? ts("PUBLISHED") : "Published", value: stats.publishedOffers, color: STATUS_COLORS.PUBLISHED },
    { label: ts.has("DRAFT") ? ts("DRAFT") : "Draft", value: stats.draftOffers, color: STATUS_COLORS.DRAFT },
    { label: ts.has("IN_ENRICHMENT") ? ts("IN_ENRICHMENT") : "In Enrichment", value: stats.inEnrichment, color: STATUS_COLORS.IN_ENRICHMENT },
    { label: ts.has("IN_VALIDATION") ? ts("IN_VALIDATION") : "In Validation", value: stats.inValidation, color: STATUS_COLORS.IN_VALIDATION },
  ], [stats, ts]);

  const statCards = [
    {
      label: t("totalOffers"),
      value: stats.totalOffers,
      accent: "text-primary bg-primary/10",
      icon: (
        <svg className="size-5" viewBox="0 0 20 20" fill="none">
          <path d="M10 2l2.5 5 5.5.8-4 3.9.9 5.3L10 14.5 5.1 17l.9-5.3-4-3.9 5.5-.8L10 2z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
        </svg>
      ),
    },
    {
      label: t("published"),
      value: stats.publishedOffers,
      accent: "text-emerald-600 dark:text-emerald-400 bg-emerald-500/10",
      icon: (
        <svg className="size-5" viewBox="0 0 20 20" fill="none">
          <circle cx="10" cy="10" r="7" stroke="currentColor" strokeWidth="1.5" />
          <path d="M7 10l2 2 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      ),
    },
    {
      label: t("products"),
      value: stats.catalogItems,
      accent: "text-blue-600 dark:text-blue-400 bg-blue-500/10",
      icon: (
        <svg className="size-5" viewBox="0 0 20 20" fill="none">
          <rect x="2" y="2" width="7" height="7" rx="1.5" stroke="currentColor" strokeWidth="1.5" />
          <rect x="11" y="2" width="7" height="7" rx="1.5" stroke="currentColor" strokeWidth="1.5" />
          <rect x="2" y="11" width="7" height="7" rx="1.5" stroke="currentColor" strokeWidth="1.5" />
          <rect x="11" y="11" width="7" height="7" rx="1.5" stroke="currentColor" strokeWidth="1.5" />
        </svg>
      ),
    },
    {
      label: t("users"),
      value: stats.totalUsers,
      accent: "text-purple-600 dark:text-purple-400 bg-purple-500/10",
      icon: (
        <svg className="size-5" viewBox="0 0 20 20" fill="none">
          <circle cx="10" cy="7" r="4" stroke="currentColor" strokeWidth="1.5" />
          <path d="M3 18c0-3.3 3.1-6 7-6s7 2.7 7 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
      ),
    },
  ];

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    if (diffDays === 0) return t("today");
    if (diffDays === 1) return t("yesterday");
    return date.toLocaleDateString(undefined, { day: "numeric", month: "short" });
  };

  return (
    <div className="flex flex-col gap-8 pb-8">

      {/* ===== HEADER ===== */}
      <div>
        <h1 className="text-2xl font-bold text-black dark:text-white">
          {greeting}, {user?.firstName} 👋
        </h1>
        <p className="text-sm text-text-secondary dark:text-neutral-500 mt-1">
          {t("subtitle")}
        </p>
      </div>

      {/* ===== 4 STAT CARDS ===== */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {statCards.map((card, i) => (
          <div
            key={card.label}
            className="rounded-2xl border border-border dark:border-neutral-800 bg-white dark:bg-neutral-900 p-5 shadow-card transition-all duration-200 hover:shadow-lg hover:-translate-y-0.5 group animate-fade-in"
            style={{ animationDelay: `${i * 80}ms`, animationFillMode: "backwards" }}
          >
            <div className="flex items-start justify-between">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-wider text-text-secondary dark:text-neutral-500">
                  {card.label}
                </p>
                {loading ? (
                  <Skeleton className="w-12 h-8 mt-3" />
                ) : (
                  <p className="mt-3 text-3xl font-bold text-black dark:text-white tabular-nums leading-none">
                    {card.value}
                  </p>
                )}
              </div>
              <div className={`rounded-xl p-2.5 ${card.accent} transition-transform duration-200 group-hover:scale-110`}>
                {card.icon}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* ===== DONUT + OFFRES RECENTES (50/50) ===== */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

        {/* Donut — Répartition des offres */}
        <div className="rounded-2xl border border-border dark:border-neutral-800 bg-white dark:bg-neutral-900 p-6 shadow-card animate-fade-in" style={{ animationDelay: "250ms", animationFillMode: "backwards" }}>
          <h2 className="text-sm font-bold text-black dark:text-white uppercase tracking-wider mb-6">
            {t("offerBreakdown")}
          </h2>
          {loading ? (
            <div className="flex items-center justify-center h-52">
              <div className="size-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
            </div>
          ) : (
            <div className="flex items-start gap-8">
              <DonutChart segments={donutSegments} total={stats.totalOffers} />
              <div className="flex flex-col gap-4 flex-1 min-w-0 pt-2">
                {donutSegments.map((seg) => {
                  const pct = stats.totalOffers > 0 ? Math.round((seg.value / stats.totalOffers) * 100) : 0;
                  return (
                    <div key={seg.label} className="flex flex-col gap-1.5">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="size-2.5 rounded-full shrink-0" style={{ backgroundColor: seg.color }} />
                          <span className="text-xs font-medium text-black dark:text-neutral-300 truncate">{seg.label}</span>
                        </div>
                        <span className="text-xs font-bold text-black dark:text-white tabular-nums">
                          {seg.value} <span className="text-neutral-400 font-normal">{pct}%</span>
                        </span>
                      </div>
                      <ProgressBar value={seg.value} max={stats.totalOffers} color={seg.color} />
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Offres récentes */}
        <div className="rounded-2xl border border-border dark:border-neutral-800 bg-white dark:bg-neutral-900 shadow-card overflow-hidden animate-fade-in flex flex-col" style={{ animationDelay: "350ms", animationFillMode: "backwards" }}>
          <div className="flex items-center justify-between px-6 py-4 border-b border-border dark:border-neutral-800 shrink-0">
            <h2 className="text-sm font-bold text-black dark:text-white uppercase tracking-wider">
              {t("recentOffers")}
            </h2>
            <Link href="/offers" className="text-xs font-medium text-primary hover:text-primary-light transition-colors">
              {t("viewAll")}
            </Link>
          </div>
          <div className="divide-y divide-border dark:divide-neutral-800 flex-1">
            {loading ? (
              <div className="px-6 py-2 flex flex-col">
                {[...Array(5)].map((_, i) => (
                  <div key={i} className="flex items-center justify-between py-3.5">
                    <div className="flex items-center gap-3">
                      <Skeleton className="size-9 !rounded-xl" />
                      <div className="flex flex-col gap-1.5">
                        <Skeleton className="w-36 h-4" />
                        <Skeleton className="w-24 h-3" />
                      </div>
                    </div>
                    <Skeleton className="w-16 h-6 !rounded-lg" />
                  </div>
                ))}
              </div>
            ) : recentOffers.length === 0 ? (
              <div className="flex-1 flex items-center justify-center px-6 py-12">
                <div className="flex flex-col items-center gap-3">
                  <div className="size-14 rounded-2xl bg-neutral-100 dark:bg-neutral-800 flex items-center justify-center">
                    <svg className="size-7 text-neutral-400" viewBox="0 0 20 20" fill="none">
                      <path d="M10 2l2.5 5 5.5.8-4 3.9.9 5.3L10 14.5 5.1 17l.9-5.3-4-3.9 5.5-.8L10 2z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
                    </svg>
                  </div>
                  <p className="text-sm text-text-secondary dark:text-neutral-500">
                    {t("noOffers")}
                  </p>
                </div>
              </div>
            ) : (
              recentOffers.map((offer) => (
                <div
                  key={offer.id}
                  className="flex items-center justify-between px-6 py-3.5 hover:bg-neutral-50 dark:hover:bg-neutral-800/30 transition-colors"
                >
                  <div className="flex items-center gap-3 min-w-0 flex-1 mr-3">
                    <StatusIcon status={offer.status} />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-black dark:text-white truncate">
                        {offer.name}
                      </p>
                      <p className="text-xs text-text-secondary dark:text-neutral-500 truncate mt-0.5">
                        {offer.shortDescription}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <span className="text-[11px] text-neutral-400 hidden md:block tabular-nums">
                      {formatDate(offer.updatedAt ?? offer.createdAt)}
                    </span>
                    <span className={`inline-flex items-center px-2.5 py-1 text-[11px] font-semibold rounded-lg ${
                      STATUS_ICON_STYLES[offer.status] ?? STATUS_ICON_STYLES.DRAFT
                    }`}>
                      {ts.has(offer.status) ? ts(offer.status) : offer.status}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* ===== ASTUCE — pleine largeur, discrète ===== */}
      <div className="rounded-2xl border border-primary/15 bg-primary/[0.03] dark:bg-primary/[0.06] px-6 py-4 animate-fade-in" style={{ animationDelay: "450ms", animationFillMode: "backwards" }}>
        <div className="flex items-center gap-3">
          <div className="rounded-lg bg-primary/10 p-2 text-primary shrink-0">
            <svg className="size-4" viewBox="0 0 20 20" fill="none">
              <path d="M10 3a4 4 0 014 4c0 1.5-.8 2.5-1.5 3.2-.4.4-.5.6-.5 1.3V12H8v-.5c0-.7-.1-.9-.5-1.3C6.8 9.5 6 8.5 6 7a4 4 0 014-4z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M8 14.5h4M8.5 17h3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          </div>
          <div className="flex-1 min-w-0">
            <span className="text-xs font-bold text-primary mr-2">{t("smartTip")}</span>
            <span className="text-xs text-text-secondary dark:text-neutral-400">
              {stats.draftOffers > 0
                ? t("tipDrafts", { count: stats.draftOffers })
                : stats.totalOffers === 0
                  ? t("tipEmpty")
                  : t("tipGood")}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
