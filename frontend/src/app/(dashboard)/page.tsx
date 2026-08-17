"use client";

import { useEffect, useState } from "react";
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
}

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

        const offers: Offer[] = offersRes.data.content ?? offersRes.data;
        setStats({
          totalOffers: offers.length,
          publishedOffers: offers.filter((o) => o.status === "PUBLISHED").length,
          draftOffers: offers.filter((o) => o.status === "DRAFT").length,
          catalogItems: catalogRes.data.length,
          totalUsers: usersRes.data.length,
          activeCampaigns: campaignsRes.data.filter((c: { status: string }) => c.status === "PUBLISHED" || c.status === "SCHEDULED").length,
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
    {
      label: t("drafts"),
      value: stats.draftOffers,
      accent: "text-amber-600 dark:text-amber-400 bg-amber-500/10",
      icon: (
        <svg className="size-5" viewBox="0 0 20 20" fill="none">
          <rect x="3" y="2" width="14" height="16" rx="2" stroke="currentColor" strokeWidth="1.5" />
          <path d="M7 7h6M7 10.5h4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
      ),
    },
    {
      label: t("activeCampaigns"),
      value: stats.activeCampaigns,
      accent: "text-pink-600 dark:text-pink-400 bg-pink-500/10",
      icon: (
        <svg className="size-5" viewBox="0 0 20 20" fill="none">
          <path d="M3 4l7 4 7-4M3 4v12h14V4H3z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
        </svg>
      ),
    },
  ];

  return (
    <div className="flex flex-col gap-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-black dark:text-white">
          {greeting}, {user?.firstName}
        </h1>
        <p className="text-sm text-text-secondary dark:text-neutral-500 mt-0.5">
          {t("subtitle")}
        </p>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
        {statCards.map((card) => (
          <div
            key={card.label}
            className="rounded-2xl border border-border dark:border-neutral-800 bg-white dark:bg-neutral-900 p-5 shadow-card transition-all duration-200 hover:shadow-lg"
          >
            <div className="flex items-start justify-between">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-wider text-text-secondary dark:text-neutral-500">
                  {card.label}
                </p>
                <p className="mt-2 text-3xl font-bold text-black dark:text-white tabular-nums">
                  {loading ? (
                    <span className="inline-block w-8 h-8 rounded-md bg-neutral-100 dark:bg-neutral-800 animate-pulse" />
                  ) : (
                    card.value
                  )}
                </p>
              </div>
              <div className={`rounded-xl p-2.5 ${card.accent}`}>
                {card.icon}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Recent offers */}
      <div className="rounded-2xl border border-border dark:border-neutral-800 bg-white dark:bg-neutral-900 shadow-card overflow-hidden">
        <div className="flex items-center justify-between px-6 py-3 border-b border-blue-600 bg-blue-600 dark:bg-blue-700 rounded-t-2xl">
          <h2 className="text-sm font-semibold text-white uppercase tracking-wider">
            {t("recentOffers")}
          </h2>
          <span className="text-xs text-white/70">
            {recentOffers.length} {recentOffers.length > 1 ? tc("results") : tc("result")}
          </span>
        </div>
        <div className="divide-y divide-border dark:divide-neutral-800">
          {loading ? (
            <div className="px-6 py-4 flex flex-col gap-3">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="flex items-center justify-between">
                  <div className="flex flex-col gap-1.5">
                    <div className="w-40 h-4 rounded bg-neutral-100 dark:bg-neutral-800 animate-pulse" />
                    <div className="w-24 h-3 rounded bg-neutral-100 dark:bg-neutral-800 animate-pulse" />
                  </div>
                  <div className="w-16 h-5 rounded bg-neutral-100 dark:bg-neutral-800 animate-pulse" />
                </div>
              ))}
            </div>
          ) : recentOffers.length === 0 ? (
            <div className="px-6 py-12 text-center">
              <div className="flex flex-col items-center gap-3">
                <div className="size-12 rounded-xl bg-neutral-100 dark:bg-neutral-800 flex items-center justify-center">
                  <svg className="size-6 text-neutral-400" viewBox="0 0 16 16" fill="none">
                    <path d="M8 2l2 4 4.4.6-3.2 3.1.8 4.3L8 11.8 3.9 14l.8-4.3L1.6 6.6 6 6l2-4z" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round" />
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
                <div className="min-w-0 flex-1 mr-4">
                  <p className="text-sm font-bold text-black dark:text-white truncate">
                    {offer.name}
                  </p>
                  <p className="text-xs text-text-secondary dark:text-neutral-500 truncate">
                    {offer.shortDescription}
                  </p>
                </div>
                <span className="inline-flex items-center px-2 py-0.5 text-[11px] font-medium bg-black text-white dark:bg-white dark:text-black shrink-0" style={{ borderRadius: 4 }}>
                  {ts.has(offer.status) ? ts(offer.status) : offer.status}
                </span>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
