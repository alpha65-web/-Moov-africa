"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth";
import api from "@/lib/api";
import StatusBadge from "@/components/StatusBadge";
import type { Offer, OfferStatus } from "@/lib/types";
import { Package, Tag, Megaphone, Users } from "lucide-react";

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
          publishedOffers: offers.filter((o) => o.status === "PUBLISHED")
            .length,
          draftOffers: offers.filter((o) => o.status === "DRAFT").length,
          catalogItems: catalogRes.data.length,
        });
        setRecentOffers(offers.slice(0, 5));
      } catch {
        // API pas encore disponible
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const statCards = [
    {
      label: "Total offres",
      value: stats.totalOffers,
      icon: Tag,
      color: "bg-blue-50 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400",
    },
    {
      label: "Offres publiees",
      value: stats.publishedOffers,
      icon: Megaphone,
      color:
        "bg-green-50 text-green-600 dark:bg-green-900/30 dark:text-green-400",
    },
    {
      label: "Brouillons",
      value: stats.draftOffers,
      icon: Package,
      color:
        "bg-yellow-50 text-yellow-600 dark:bg-yellow-900/30 dark:text-yellow-400",
    },
    {
      label: "Produits catalogue",
      value: stats.catalogItems,
      icon: Users,
      color:
        "bg-purple-50 text-purple-600 dark:bg-purple-900/30 dark:text-purple-400",
    },
  ];

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-secondary dark:text-white">
          Bonjour, {user?.firstName}
        </h1>
        <p className="mt-1 text-sm text-text-secondary">
          Bienvenue sur la plateforme PIM Moov Africa
        </p>
      </div>

      <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {statCards.map((card) => (
          <div
            key={card.label}
            className="rounded-xl border border-border bg-white p-5 dark:border-neutral-700 dark:bg-neutral-900"
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-text-secondary">{card.label}</p>
                <p className="mt-1 text-2xl font-bold text-secondary dark:text-white">
                  {loading ? "..." : card.value}
                </p>
              </div>
              <div className={`rounded-lg p-2.5 ${card.color}`}>
                <card.icon className="h-5 w-5" />
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="rounded-xl border border-border bg-white dark:border-neutral-700 dark:bg-neutral-900">
        <div className="border-b border-border px-6 py-4 dark:border-neutral-700">
          <h2 className="text-lg font-semibold text-secondary dark:text-white">
            Offres recentes
          </h2>
        </div>
        <div className="divide-y divide-border dark:divide-neutral-700">
          {loading ? (
            <div className="px-6 py-8 text-center text-sm text-text-secondary">
              Chargement...
            </div>
          ) : recentOffers.length === 0 ? (
            <div className="px-6 py-8 text-center text-sm text-text-secondary">
              Aucune offre pour le moment. L&apos;API backend doit etre
              demarree.
            </div>
          ) : (
            recentOffers.map((offer) => (
              <div
                key={offer.id}
                className="flex items-center justify-between px-6 py-4"
              >
                <div>
                  <p className="text-sm font-medium text-secondary dark:text-white">
                    {offer.name}
                  </p>
                  <p className="text-xs text-text-secondary">
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
