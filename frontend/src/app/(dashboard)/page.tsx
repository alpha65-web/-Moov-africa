"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth";
import api from "@/lib/api";
import StatusBadge from "@/components/StatusBadge";
import type { Offer, OfferStatus } from "@/lib/types";

/* ===== ICÔNES STAT CARDS ===== */

function TagIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 20 20" fill="none">
      <path d="M10 2l2.5 5 5.5.8-4 3.9.9 5.3L10 14.5 5.1 17l.9-5.3-4-3.9 5.5-.8L10 2z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
    </svg>
  );
}

function PublishIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 20 20" fill="none">
      <circle cx="10" cy="10" r="7" stroke="currentColor" strokeWidth="1.5" />
      <path d="M7 10l2 2 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function DraftIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 20 20" fill="none">
      <rect x="3" y="2" width="14" height="16" rx="2" stroke="currentColor" strokeWidth="1.5" />
      <path d="M7 7h6M7 10.5h4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

function CatalogIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 20 20" fill="none">
      <rect x="2" y="2" width="7" height="7" rx="1.5" stroke="currentColor" strokeWidth="1.5" />
      <rect x="11" y="2" width="7" height="7" rx="1.5" stroke="currentColor" strokeWidth="1.5" />
      <rect x="2" y="11" width="7" height="7" rx="1.5" stroke="currentColor" strokeWidth="1.5" />
      <rect x="11" y="11" width="7" height="7" rx="1.5" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  );
}

interface Stats {
  totalOffers: number;
  publishedOffers: number;
  draftOffers: number;
  catalogItems: number;
}

export default function DashboardPage() {
  const { user } = useAuth();
  const [stats, setStats] = useState<Stats>({
    totalOffers: 0,
    publishedOffers: 0,
    draftOffers: 0,
    catalogItems: 0,
  });
  const [recentOffers, setRecentOffers] = useState<Offer[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const [offersRes, catalogRes] = await Promise.all([
          api.get("/offers").catch(() => ({ data: [] })),
          api.get("/catalog").catch(() => ({ data: [] })),
        ]);

        const offers: Offer[] = offersRes.data;
        setStats({
          totalOffers: offers.length,
          publishedOffers: offers.filter((o) => o.status === "PUBLISHED").length,
          draftOffers: offers.filter((o) => o.status === "DRAFT").length,
          catalogItems: catalogRes.data.length,
        });
        setRecentOffers(offers.slice(0, 5));
      } catch {
        /* API pas encore disponible */
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const hour = new Date().getHours();
  const greeting =
    hour < 12 ? "Bonjour" : hour < 18 ? "Bon après-midi" : "Bonsoir";

  const statCards = [
    {
      label: "Total offres",
      value: stats.totalOffers,
      icon: TagIcon,
      accent: "text-primary bg-primary/10",
    },
    {
      label: "Publiées",
      value: stats.publishedOffers,
      icon: PublishIcon,
      accent: "text-emerald-600 dark:text-emerald-400 bg-emerald-500/10",
    },
    {
      label: "Brouillons",
      value: stats.draftOffers,
      icon: DraftIcon,
      accent: "text-amber-600 dark:text-amber-400 bg-amber-500/10",
    },
    {
      label: "Produits",
      value: stats.catalogItems,
      icon: CatalogIcon,
      accent: "text-blue-600 dark:text-blue-400 bg-blue-500/10",
    },
  ];

  return (
    <div className="max-w-5xl">
      {/* ===== EN-TÊTE ===== */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold tracking-tight text-secondary dark:text-white">
          {greeting}, {user?.firstName}
        </h1>
        <p className="mt-1 text-sm text-text-secondary dark:text-neutral-400">
          Voici un aperçu de votre plateforme PIM
        </p>
      </div>

      {/* ===== STAT CARDS ===== */}
      <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {statCards.map((card) => (
          <div
            key={card.label}
            className="rounded-2xl border border-border dark:border-neutral-800 bg-white dark:bg-neutral-900 p-5 shadow-card transition-all duration-200 hover:shadow-lg"
          >
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs font-medium uppercase tracking-wider text-text-secondary dark:text-neutral-500">
                  {card.label}
                </p>
                <p className="mt-2 text-3xl font-bold tracking-tight text-secondary dark:text-white">
                  {loading ? (
                    <span className="inline-block w-8 h-8 rounded-md bg-neutral-100 dark:bg-neutral-800 animate-pulse" />
                  ) : (
                    card.value
                  )}
                </p>
              </div>
              <div className={`rounded-xl p-2.5 ${card.accent}`}>
                <card.icon className="size-5" />
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* ===== OFFRES RÉCENTES ===== */}
      <div className="rounded-2xl border border-border dark:border-neutral-800 bg-white dark:bg-neutral-900 shadow-card overflow-hidden">
        <div className="flex items-center justify-between border-b border-border dark:border-neutral-800 px-6 py-4">
          <h2 className="text-base font-semibold text-secondary dark:text-white">
            Offres récentes
          </h2>
          <span className="text-xs text-text-secondary dark:text-neutral-500">
            {recentOffers.length} résultats
          </span>
        </div>
        <div className="divide-y divide-border dark:divide-neutral-800">
          {loading ? (
            <div className="px-6 py-4 flex flex-col gap-3">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="flex items-center justify-between">
                  <div className="flex flex-col gap-1.5">
                    <div className="w-40 h-4 rounded-md bg-neutral-100 dark:bg-neutral-800 animate-pulse" />
                    <div className="w-24 h-3 rounded-md bg-neutral-100 dark:bg-neutral-800 animate-pulse" />
                  </div>
                  <div className="w-16 h-5 rounded-full bg-neutral-100 dark:bg-neutral-800 animate-pulse" />
                </div>
              ))}
            </div>
          ) : recentOffers.length === 0 ? (
            <div className="px-6 py-12 text-center">
              <p className="text-sm text-text-secondary dark:text-neutral-500">
                Aucune offre pour le moment
              </p>
              <p className="mt-1 text-xs text-neutral-400 dark:text-neutral-600">
                Les offres apparaîtront ici une fois le backend démarré
              </p>
            </div>
          ) : (
            recentOffers.map((offer) => (
              <div
                key={offer.id}
                className="flex items-center justify-between px-6 py-3.5 hover:bg-neutral-50 dark:hover:bg-neutral-800/50 transition-colors"
              >
                <div className="min-w-0 flex-1 mr-4">
                  <p className="text-sm font-medium text-secondary dark:text-white truncate">
                    {offer.name}
                  </p>
                  <p className="text-xs text-text-secondary dark:text-neutral-500 truncate">
                    {offer.shortDescription}
                  </p>
                </div>
                <StatusBadge status={offer.status as OfferStatus} />
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
