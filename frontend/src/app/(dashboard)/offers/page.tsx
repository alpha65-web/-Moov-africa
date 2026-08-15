"use client";

import { useEffect, useState } from "react";
import api from "@/lib/api";
import type { Offer, OfferStatus } from "@/lib/types";
import { OFFER_STATUS_LABELS } from "@/lib/types";
import StatusBadge from "@/components/StatusBadge";
import toast from "react-hot-toast";
import { Plus, ChevronRight } from "lucide-react";

const ALLOWED_TRANSITIONS: Record<string, OfferStatus[]> = {
  DRAFT: ["IN_ENRICHMENT"],
  IN_ENRICHMENT: ["IN_VALIDATION", "DRAFT"],
  IN_VALIDATION: ["VALIDATED", "IN_ENRICHMENT"],
  VALIDATED: ["PLANNED", "PUBLISHED"],
  PLANNED: ["PUBLISHED", "SUSPENDED"],
  PUBLISHED: ["SUSPENDED", "OBSOLETE", "WITHDRAWN"],
  SUSPENDED: ["PUBLISHED", "WITHDRAWN"],
  OBSOLETE: ["ARCHIVED"],
  WITHDRAWN: ["ARCHIVED"],
};

export default function OffersPage() {
  const [offers, setOffers] = useState<Offer[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState<string>("ALL");
  const [showCreate, setShowCreate] = useState(false);
  const [selectedOffer, setSelectedOffer] = useState<Offer | null>(null);
  const [form, setForm] = useState({
    name: "",
    shortDescription: "",
    longDescription: "",
    promotionalPrice: "",
    legalMentions: "",
  });
  const [transitionComment, setTransitionComment] = useState("");

  useEffect(() => {
    loadOffers();
  }, []);

  async function loadOffers() {
    try {
      const { data } = await api.get("/offers");
      setOffers(data);
    } catch {
      // API not available
    } finally {
      setLoading(false);
    }
  }

  const filtered =
    filterStatus === "ALL"
      ? offers
      : offers.filter((o) => o.status === filterStatus);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    try {
      await api.post("/offers", {
        name: form.name,
        shortDescription: form.shortDescription,
        longDescription: form.longDescription,
        promotionalPrice: parseFloat(form.promotionalPrice) || null,
        legalMentions: form.legalMentions,
        catalogItemIds: [],
      });
      toast.success("Offre creee");
      setShowCreate(false);
      setForm({
        name: "",
        shortDescription: "",
        longDescription: "",
        promotionalPrice: "",
        legalMentions: "",
      });
      loadOffers();
    } catch {
      toast.error("Erreur lors de la creation");
    }
  }

  async function handleTransition(offerId: string, targetStatus: OfferStatus) {
    const needsComment =
      targetStatus === "IN_ENRICHMENT" || targetStatus === "DRAFT";
    if (needsComment && !transitionComment.trim()) {
      toast.error("Un commentaire est requis pour cette transition");
      return;
    }
    try {
      await api.post(`/offers/${offerId}/transition`, {
        targetStatus,
        comment: transitionComment || null,
      });
      toast.success(`Statut mis a jour : ${OFFER_STATUS_LABELS[targetStatus]}`);
      setSelectedOffer(null);
      setTransitionComment("");
      loadOffers();
    } catch (err: unknown) {
      const msg =
        err && typeof err === "object" && "response" in err
          ? (err as { response?: { data?: { message?: string } } }).response
              ?.data?.message
          : "Transition impossible";
      toast.error(msg || "Transition impossible");
    }
  }

  const statusFilters: { key: string; label: string }[] = [
    { key: "ALL", label: "Toutes" },
    ...Object.entries(OFFER_STATUS_LABELS).map(([key, label]) => ({
      key,
      label,
    })),
  ];

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            Offres
          </h1>
          <p className="mt-1 text-sm text-gray-500">
            Cycle de vie complet des offres commerciales
          </p>
        </div>
        <button
          onClick={() => setShowCreate(!showCreate)}
          className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-blue-700"
        >
          <Plus className="h-4 w-4" />
          Nouvelle offre
        </button>
      </div>

      {showCreate && (
        <form
          onSubmit={handleCreate}
          className="mb-6 rounded-xl border border-gray-200 bg-white p-6 dark:border-gray-700 dark:bg-gray-900"
        >
          <h3 className="mb-4 text-lg font-semibold text-gray-900 dark:text-white">
            Creer une offre
          </h3>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
                Nom de l&apos;offre
              </label>
              <input
                required
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-white"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
                Prix promotionnel (XOF)
              </label>
              <input
                type="number"
                value={form.promotionalPrice}
                onChange={(e) =>
                  setForm({ ...form, promotionalPrice: e.target.value })
                }
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-white"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
                Description courte
              </label>
              <input
                value={form.shortDescription}
                onChange={(e) =>
                  setForm({ ...form, shortDescription: e.target.value })
                }
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-white"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
                Mentions legales
              </label>
              <input
                value={form.legalMentions}
                onChange={(e) =>
                  setForm({ ...form, legalMentions: e.target.value })
                }
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-white"
              />
            </div>
            <div className="sm:col-span-2">
              <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
                Description longue
              </label>
              <textarea
                value={form.longDescription}
                onChange={(e) =>
                  setForm({ ...form, longDescription: e.target.value })
                }
                rows={3}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-white"
              />
            </div>
          </div>
          <div className="mt-4 flex gap-3">
            <button
              type="submit"
              className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
            >
              Creer l&apos;offre
            </button>
            <button
              type="button"
              onClick={() => setShowCreate(false)}
              className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-300"
            >
              Annuler
            </button>
          </div>
        </form>
      )}

      <div className="mb-4 flex flex-wrap gap-2">
        {statusFilters.map((f) => (
          <button
            key={f.key}
            onClick={() => setFilterStatus(f.key)}
            className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
              filterStatus === f.key
                ? "bg-blue-600 text-white"
                : "bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-300"
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {selectedOffer && (
        <div className="mb-6 rounded-xl border border-blue-200 bg-blue-50 p-6 dark:border-blue-800 dark:bg-blue-900/20">
          <h3 className="mb-3 text-sm font-semibold text-blue-900 dark:text-blue-300">
            Transition : {selectedOffer.name}
          </h3>
          <p className="mb-3 text-xs text-blue-700 dark:text-blue-400">
            Statut actuel : {OFFER_STATUS_LABELS[selectedOffer.status]}
          </p>
          <div className="mb-3">
            <input
              placeholder="Commentaire (obligatoire pour un rejet)"
              value={transitionComment}
              onChange={(e) => setTransitionComment(e.target.value)}
              className="w-full rounded-lg border border-blue-300 px-3 py-2 text-sm dark:border-blue-700 dark:bg-gray-800 dark:text-white"
            />
          </div>
          <div className="flex flex-wrap gap-2">
            {(ALLOWED_TRANSITIONS[selectedOffer.status] || []).map(
              (target) => (
                <button
                  key={target}
                  onClick={() =>
                    handleTransition(selectedOffer.id, target)
                  }
                  className="flex items-center gap-1 rounded-lg bg-white px-3 py-1.5 text-xs font-medium text-gray-700 shadow-sm hover:bg-gray-50 dark:bg-gray-800 dark:text-gray-300"
                >
                  <ChevronRight className="h-3 w-3" />
                  {OFFER_STATUS_LABELS[target]}
                </button>
              )
            )}
            <button
              onClick={() => {
                setSelectedOffer(null);
                setTransitionComment("");
              }}
              className="rounded-lg px-3 py-1.5 text-xs text-gray-500 hover:text-gray-700"
            >
              Fermer
            </button>
          </div>
        </div>
      )}

      <div className="rounded-xl border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-900">
        {loading ? (
          <div className="p-8 text-center text-sm text-gray-500">
            Chargement...
          </div>
        ) : filtered.length === 0 ? (
          <div className="p-8 text-center text-sm text-gray-500">
            Aucune offre trouvee
          </div>
        ) : (
          <div className="divide-y divide-gray-200 dark:divide-gray-700">
            {filtered.map((offer) => (
              <div
                key={offer.id}
                className="flex cursor-pointer items-center justify-between px-6 py-4 hover:bg-gray-50 dark:hover:bg-gray-800/50"
                onClick={() => setSelectedOffer(offer)}
              >
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-gray-900 dark:text-white">
                    {offer.name}
                  </p>
                  <p className="truncate text-xs text-gray-500">
                    {offer.shortDescription || "Pas de description"}
                  </p>
                </div>
                <div className="ml-4 flex items-center gap-3">
                  {offer.promotionalPrice && (
                    <span className="text-sm font-semibold text-gray-900 dark:text-white">
                      {offer.promotionalPrice.toLocaleString("fr-FR")} XOF
                    </span>
                  )}
                  <StatusBadge status={offer.status as OfferStatus} />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
