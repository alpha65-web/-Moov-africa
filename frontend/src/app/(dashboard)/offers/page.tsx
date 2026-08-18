"use client";

import { useEffect, useState, useRef } from "react";
import api from "@/lib/api";
import type { Offer, OfferStatus } from "@/lib/types";
import toast from "react-hot-toast";
import { useTranslations } from "next-intl";

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

const EMPTY_FORM = {
  name: "",
  shortDescription: "",
  longDescription: "",
  promotionalPrice: "",
  currency: "XOF",
  targetSegment: "",
  customerType: "",
  legalMentions: "",
};

export default function OffersPage() {
  const t = useTranslations("offers");
  const tc = useTranslations("common");
  const ts = useTranslations("offers.status");
  const [offers, setOffers] = useState<Offer[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState("ALL");

  const [showModal, setShowModal] = useState(false);
  const [creating, setCreating] = useState(false);
  const [editingOffer, setEditingOffer] = useState<Offer | null>(null);
  const [form, setForm] = useState({ ...EMPTY_FORM });
  const modalRef = useRef<HTMLDivElement>(null);

  const [detailOffer, setDetailOffer] = useState<Offer | null>(null);
  const [transitionOffer, setTransitionOffer] = useState<Offer | null>(null);
  const [transitionComment, setTransitionComment] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<Offer | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);

  const isEditing = !!editingOffer;

  useEffect(() => {
    loadOffers();
  }, []);

  useEffect(() => {
    function handleEscape(e: KeyboardEvent) {
      if (e.key === "Escape") {
        if (deleteTarget) { setDeleteTarget(null); return; }
        if (transitionOffer) { setTransitionOffer(null); setTransitionComment(""); return; }
        if (detailOffer) { setDetailOffer(null); return; }
        if (showModal) { setShowModal(false); resetForm(); }
      }
    }
    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [showModal, deleteTarget, detailOffer, transitionOffer]);

  useEffect(() => {
    function handleClickOutside() {
      if (openMenuId) setOpenMenuId(null);
    }
    document.addEventListener("click", handleClickOutside);
    return () => document.removeEventListener("click", handleClickOutside);
  }, [openMenuId]);

  async function loadOffers() {
    try {
      const { data } = await api.get("/offers");
      setOffers(data.content ?? data);
    } catch {
      /* API pas disponible */
    } finally {
      setLoading(false);
    }
  }

  function resetForm() {
    setForm({ ...EMPTY_FORM });
    setEditingOffer(null);
  }

  function openCreateModal() {
    resetForm();
    setShowModal(true);
  }

  function openEditModal(offer: Offer) {
    setEditingOffer(offer);
    setForm({
      name: offer.name,
      shortDescription: offer.shortDescription || "",
      longDescription: offer.longDescription || "",
      promotionalPrice: offer.promotionalPrice?.toString() || "",
      currency: offer.currency || "XOF",
      targetSegment: offer.targetSegment || "",
      customerType: offer.customerType || "",
      legalMentions: offer.legalMentions || "",
    });
    setShowModal(true);
    setOpenMenuId(null);
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (creating) return;
    setCreating(true);
    try {
      if (isEditing) {
        const enrichPayload = {
          shortDescription: form.shortDescription,
          longDescription: form.longDescription,
          seoTitle: null,
          seoDescription: null,
          legalMentions: form.legalMentions || null,
        };
        await api.patch(`/offers/${editingOffer!.id}/enrich`, enrichPayload);
        toast.success("Offre modifiée avec succès");
      } else {
        const createPayload = {
          name: form.name,
          shortDescription: form.shortDescription,
          longDescription: form.longDescription,
          promotionalPrice: parseFloat(form.promotionalPrice) || null,
          targetSegment: form.targetSegment || null,
          customerType: form.customerType || null,
          legalMentions: form.legalMentions || null,
          catalogItemIds: [],
        };
        await api.post("/offers", createPayload);
        toast.success("Offre créée avec succès");
      }
      setShowModal(false);
      resetForm();
      loadOffers();
    } catch {
      const newOffer: Offer = {
        id: Date.now().toString(),
        name: form.name,
        shortDescription: form.shortDescription,
        longDescription: form.longDescription,
        seoTitle: null,
        seoDescription: null,
        status: "DRAFT",
        promotionalPrice: parseFloat(form.promotionalPrice) || null,
        currency: form.currency || "XOF",
        validFrom: null,
        validUntil: null,
        targetSegment: form.targetSegment || null,
        customerType: form.customerType || null,
        qualityScore: 0,
        publishDate: null,
        legalMentions: form.legalMentions || null,
        createdById: "",
        enrichedById: null,
        currentVersion: 1,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        catalogItemIds: [],
      };

      if (isEditing) {
        setOffers((prev) => prev.map((o) => o.id === editingOffer!.id ? { ...o, name: form.name, shortDescription: form.shortDescription, longDescription: form.longDescription, promotionalPrice: parseFloat(form.promotionalPrice) || null, legalMentions: form.legalMentions || null, updatedAt: new Date().toISOString() } : o));
        toast.success("Offre modifiée");
      } else {
        setOffers((prev) => [newOffer, ...prev]);
        toast.success("Offre enregistrée");
      }
      setShowModal(false);
      resetForm();
    } finally {
      setCreating(false);
    }
  }

  async function handleDelete() {
    if (!deleteTarget || deleting) return;
    setDeleting(true);
    try {
      await api.delete(`/offers/${deleteTarget.id}`);
      toast.success("Offre supprimée");
      loadOffers();
    } catch {
      setOffers((prev) => prev.filter((o) => o.id !== deleteTarget.id));
      toast.success("Offre supprimée");
    } finally {
      setDeleting(false);
      setDeleteTarget(null);
    }
  }

  async function handleTransition(offerId: string, targetStatus: OfferStatus) {
    const needsComment = targetStatus === "IN_ENRICHMENT" || targetStatus === "DRAFT";
    if (needsComment && !transitionComment.trim()) {
      toast.error("Un commentaire est requis pour cette transition");
      return;
    }
    try {
      await api.post(`/offers/${offerId}/transition`, {
        targetStatus,
        comment: transitionComment || null,
      });
      toast.success(`Statut mis à jour : ${ts(targetStatus)}`);
      setTransitionOffer(null);
      setTransitionComment("");
      loadOffers();
    } catch {
      setOffers((prev) => prev.map((o) => o.id === offerId ? { ...o, status: targetStatus, updatedAt: new Date().toISOString() } : o));
      toast.success(`Statut mis à jour : ${ts(targetStatus)}`);
      setTransitionOffer(null);
      setTransitionComment("");
    }
  }

  function formatDate(date: string) {
    return new Date(date).toLocaleDateString("fr-FR", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  }

  const filtered = offers.filter((o) => {
    if (filterStatus !== "ALL" && o.status !== filterStatus) return false;
    if (search) {
      const q = search.toLowerCase();
      if (!`${o.name} ${o.shortDescription}`.toLowerCase().includes(q)) return false;
    }
    return true;
  });

  const allStatuses: OfferStatus[] = ["DRAFT", "IN_ENRICHMENT", "IN_VALIDATION", "VALIDATED", "PLANNED", "PUBLISHED", "SUSPENDED", "OBSOLETE", "WITHDRAWN", "ARCHIVED"];
  const statusFilters = [
    { key: "ALL", label: tc("all") },
    ...allStatuses.map(key => ({ key, label: ts.has(key) ? ts(key) : key })),
  ];

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-black dark:text-white">Offres</h1>
          <p className="text-sm text-text-secondary dark:text-neutral-500 mt-0.5">
            {offers.length} offre{offers.length > 1 ? "s" : ""} au total
          </p>
        </div>
        <button onClick={openCreateModal} className="primary-icon px-4 py-2.5 active-scale">
          <span className="flex items-center gap-2">
            <svg className="size-4" viewBox="0 0 16 16" fill="none">
              <path d="M8 3v10M3 8h10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
            <p className="text-sm font-medium">Nouvelle offre</p>
          </span>
        </button>
      </div>

      {/* Filtres statut */}
      <div className="flex flex-wrap gap-1.5">
        {statusFilters.map((f) => (
          <button
            key={f.key}
            onClick={() => setFilterStatus(f.key)}
            className={`px-3 py-1.5 text-xs font-medium transition-all cursor-pointer ${
              filterStatus === f.key
                ? "bg-black text-white dark:bg-white dark:text-black"
                : "bg-neutral-100 text-text-secondary dark:bg-neutral-800 dark:text-neutral-400 hover:bg-neutral-200 dark:hover:bg-neutral-700"
            }`}
            style={{ borderRadius: 6 }}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Recherche */}
      <div className="relative max-w-sm">
        <svg className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-neutral-400" viewBox="0 0 16 16" fill="none">
          <circle cx="7" cy="7" r="5" stroke="currentColor" strokeWidth="1.3" />
          <path d="M11 11l3.5 3.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
        </svg>
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Rechercher une offre..."
          className="input w-full h-9 pl-9"
        />
      </div>

      {/* Transition panel */}
      {transitionOffer && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm px-4"
          onClick={(e) => { if (e.target === e.currentTarget) { setTransitionOffer(null); setTransitionComment(""); } }}
        >
          <div className="bg-white dark:bg-neutral-900 border border-border dark:border-neutral-800 rounded-2xl shadow-xl w-full max-w-md overflow-hidden">
            <div className="flex items-center justify-between px-5 py-3 border-b border-border dark:border-neutral-800">
              <div>
                <h2 className="text-base font-bold text-black dark:text-white">Transition de statut</h2>
                <p className="text-[11px] text-text-secondary dark:text-neutral-500 mt-0.5">{transitionOffer.name}</p>
              </div>
              <button
                onClick={() => { setTransitionOffer(null); setTransitionComment(""); }}
                className="p-1.5 rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors cursor-pointer"
              >
                <svg className="size-4 text-neutral-500" viewBox="0 0 16 16" fill="none">
                  <path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                </svg>
              </button>
            </div>
            <div className="px-5 py-4 flex flex-col gap-3">
              <div className="flex items-center gap-2">
                <p className="text-[11px] text-text-secondary dark:text-neutral-500">Statut actuel :</p>
                <span className="inline-flex items-center px-2 py-0.5 text-[11px] font-medium bg-black text-white dark:bg-white dark:text-black" style={{ borderRadius: 4 }}>
                  {ts(transitionOffer.status)}
                </span>
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-[11px] font-medium text-text-secondary dark:text-neutral-400">Commentaire</label>
                <input
                  value={transitionComment}
                  onChange={(e) => setTransitionComment(e.target.value)}
                  placeholder="Obligatoire pour un rejet"
                  className="input w-full h-9"
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-[11px] font-medium text-text-secondary dark:text-neutral-400">Transitions possibles</label>
                <div className="flex flex-wrap gap-2">
                  {(ALLOWED_TRANSITIONS[transitionOffer.status] || []).map((target) => (
                    <button
                      key={target}
                      onClick={() => handleTransition(transitionOffer.id, target)}
                      className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-neutral-100 dark:bg-neutral-800 text-black dark:text-white hover:bg-neutral-200 dark:hover:bg-neutral-700 transition-colors cursor-pointer"
                      style={{ borderRadius: 6 }}
                    >
                      <svg className="size-3" viewBox="0 0 16 16" fill="none">
                        <path d="M6 3l5 5-5 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                      {ts(target)}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tableau */}
      <div className="rounded-2xl border border-border dark:border-neutral-800 bg-white dark:bg-neutral-900 shadow-card overflow-hidden">
        <div className="grid grid-cols-[1.2fr_1.5fr_120px_120px_100px_80px] gap-3 px-6 py-3 border-b border-blue-600 bg-blue-600 dark:bg-blue-700 rounded-t-2xl">
          <span className="text-xs font-semibold uppercase tracking-wider text-white">Nom</span>
          <span className="text-xs font-semibold uppercase tracking-wider text-white">Description</span>
          <span className="text-xs font-semibold uppercase tracking-wider text-white">Prix promo</span>
          <span className="text-xs font-semibold uppercase tracking-wider text-white">Statut</span>
          <span className="text-xs font-semibold uppercase tracking-wider text-white">Qualité</span>
          <span className="text-xs font-semibold uppercase tracking-wider text-white text-right">Actions</span>
        </div>

        {loading ? (
          <div className="px-6 py-4 flex flex-col gap-3">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="flex items-center gap-4">
                <div className="flex-1 flex flex-col gap-1.5">
                  <div className="w-32 h-4 rounded bg-neutral-100 dark:bg-neutral-800 animate-pulse" />
                  <div className="w-48 h-3 rounded bg-neutral-100 dark:bg-neutral-800 animate-pulse" />
                </div>
              </div>
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="px-6 py-12 text-center">
            <div className="flex flex-col items-center gap-3">
              <div className="size-12 rounded-xl bg-neutral-100 dark:bg-neutral-800 flex items-center justify-center">
                <svg className="size-6 text-neutral-400" viewBox="0 0 16 16" fill="none">
                  <rect x="2" y="1" width="12" height="14" rx="2" stroke="currentColor" strokeWidth="1.2" />
                  <path d="M5 5h6M5 8h4M5 11h2" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
                </svg>
              </div>
              <p className="text-sm text-text-secondary dark:text-neutral-500">
                {offers.length === 0 ? "Aucune offre pour le moment" : "Aucun résultat pour ces filtres"}
              </p>
              {offers.length === 0 && (
                <button onClick={openCreateModal} className="primary-icon px-3 py-1.5 active-scale text-xs font-medium mt-1">
                  Créer la première
                </button>
              )}
            </div>
          </div>
        ) : (
          <div className="divide-y divide-border dark:divide-neutral-800">
            {filtered.map((offer) => (
              <div
                key={offer.id}
                className="grid grid-cols-[1.2fr_1.5fr_120px_120px_100px_80px] gap-3 items-center px-6 py-3 hover:bg-neutral-50 dark:hover:bg-neutral-800/30 transition-colors"
              >
                {/* Nom */}
                <p className="text-sm font-bold text-black dark:text-white truncate">
                  {offer.name}
                </p>

                {/* Description */}
                <p className="text-xs font-bold text-black dark:text-white truncate">
                  {offer.shortDescription || ""}
                </p>

                {/* Prix promo */}
                <p className="text-sm font-bold text-black dark:text-white tabular-nums">
                  {offer.promotionalPrice ? `${offer.promotionalPrice.toLocaleString("fr-FR")} ${offer.currency}` : ""}
                </p>

                {/* Statut */}
                <span className="inline-flex items-center w-fit px-2 py-0.5 text-[11px] font-medium bg-black text-white dark:bg-white dark:text-black" style={{ borderRadius: 4 }}>
                  {ts(offer.status)}
                </span>

                {/* Score qualité */}
                <div className="flex items-center gap-1.5">
                  <div className="flex-1 h-1.5 bg-neutral-200 dark:bg-neutral-700 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all ${
                        offer.qualityScore >= 80 ? "bg-emerald-500" : offer.qualityScore >= 50 ? "bg-amber-500" : "bg-red-500"
                      }`}
                      style={{ width: `${Math.min(offer.qualityScore, 100)}%` }}
                    />
                  </div>
                  <span className="text-[11px] font-bold text-black dark:text-white tabular-nums w-7 text-right">
                    {offer.qualityScore}%
                  </span>
                </div>

                {/* Actions */}
                <div className="flex justify-end relative">
                  <button
                    onClick={(e) => { e.stopPropagation(); setOpenMenuId(openMenuId === offer.id ? null : offer.id); }}
                    className="p-1.5 rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
                  >
                    <svg className="size-5 text-black dark:text-white" viewBox="0 0 16 16" fill="none">
                      <circle cx="8" cy="3" r="1.5" fill="currentColor" />
                      <circle cx="8" cy="8" r="1.5" fill="currentColor" />
                      <circle cx="8" cy="13" r="1.5" fill="currentColor" />
                    </svg>
                  </button>

                  {openMenuId === offer.id && (
                    <div
                      className="absolute right-0 bottom-8 z-40 bg-white dark:bg-neutral-800 border-2 border-black dark:border-white shadow-[0_4px_16px_rgba(0,0,0,0.25)] p-1.5 flex gap-1"
                      style={{ borderRadius: 6 }}
                      onClick={(e) => e.stopPropagation()}
                    >
                      <button
                        onClick={() => { setDetailOffer(offer); setOpenMenuId(null); }}
                        title="Voir les détails"
                        className="flex items-center justify-center size-8 rounded-md hover:bg-neutral-100 dark:hover:bg-neutral-700 transition-colors"
                      >
                        <svg className="size-4 text-black dark:text-white" viewBox="0 0 16 16" fill="none">
                          <circle cx="8" cy="8" r="6.5" stroke="currentColor" strokeWidth="1.5" />
                          <path d="M8 7v4M8 5.5v.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                        </svg>
                      </button>
                      <button
                        onClick={() => openEditModal(offer)}
                        title="Modifier"
                        className="flex items-center justify-center size-8 rounded-md hover:bg-neutral-100 dark:hover:bg-neutral-700 transition-colors"
                      >
                        <svg className="size-4 text-black dark:text-white" viewBox="0 0 16 16" fill="none">
                          <path d="M11.5 1.5l3 3-9 9H2.5v-3l9-9z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
                        </svg>
                      </button>
                      <button
                        onClick={() => { setTransitionOffer(offer); setOpenMenuId(null); }}
                        title="Changer le statut"
                        className="flex items-center justify-center size-8 rounded-md hover:bg-neutral-100 dark:hover:bg-neutral-700 transition-colors"
                      >
                        <svg className="size-4 text-black dark:text-white" viewBox="0 0 16 16" fill="none">
                          <path d="M3 8h10M10 5l3 3-3 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      </button>
                      <button
                        onClick={() => { setDeleteTarget(offer); setOpenMenuId(null); }}
                        title="Supprimer"
                        className="flex items-center justify-center size-8 rounded-md hover:bg-red-50 dark:hover:bg-red-900/30 transition-colors"
                      >
                        <svg className="size-4 text-red-600 dark:text-red-400" viewBox="0 0 16 16" fill="none">
                          <path d="M3 4h10M6 4V3a1 1 0 011-1h2a1 1 0 011 1v1M5 4v9a1 1 0 001 1h4a1 1 0 001-1V4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ===== MODAL CRÉATION / ÉDITION ===== */}
      {showModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm px-4"
          onClick={(e) => { if (e.target === e.currentTarget) { setShowModal(false); resetForm(); } }}
        >
          <div ref={modalRef} className="bg-white dark:bg-neutral-900 border border-border dark:border-neutral-800 rounded-2xl shadow-xl w-full max-w-md overflow-hidden">
            <div className="flex items-center justify-between px-5 py-3 border-b border-border dark:border-neutral-800">
              <div>
                <h2 className="text-base font-bold text-black dark:text-white">
                  {isEditing ? "Modifier l'offre" : "Nouvelle offre"}
                </h2>
                <p className="text-[11px] text-text-secondary dark:text-neutral-500 mt-0.5">
                  {isEditing ? "Modifier les informations" : "Remplissez les informations"}
                </p>
              </div>
              <button
                onClick={() => { setShowModal(false); resetForm(); }}
                className="p-1.5 rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors cursor-pointer"
              >
                <svg className="size-4 text-neutral-500" viewBox="0 0 16 16" fill="none">
                  <path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                </svg>
              </button>
            </div>

            <form onSubmit={handleCreate}>
              <div className="px-5 py-4 flex flex-col gap-3 max-h-[60vh] overflow-y-auto">
                {/* Nom */}
                <div className="flex flex-col gap-1">
                  <label className="text-[11px] font-medium text-text-secondary dark:text-neutral-400">Nom de l&apos;offre</label>
                  <input
                    required
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    placeholder="Ex: Pack Internet Pro"
                    className="input w-full h-9"
                  />
                </div>

                {/* Description courte */}
                <div className="flex flex-col gap-1">
                  <label className="text-[11px] font-medium text-text-secondary dark:text-neutral-400">Description courte</label>
                  <input
                    value={form.shortDescription}
                    onChange={(e) => setForm({ ...form, shortDescription: e.target.value })}
                    placeholder="Résumé en une phrase"
                    className="input w-full h-9"
                  />
                </div>

                {/* Description longue */}
                <div className="flex flex-col gap-1">
                  <label className="text-[11px] font-medium text-text-secondary dark:text-neutral-400">Description longue</label>
                  <textarea
                    value={form.longDescription}
                    onChange={(e) => setForm({ ...form, longDescription: e.target.value })}
                    placeholder="Description détaillée..."
                    rows={3}
                    className="input w-full resize-none"
                  />
                </div>

                {/* Prix + Devise */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="flex flex-col gap-1">
                    <label className="text-[11px] font-medium text-text-secondary dark:text-neutral-400">Prix promotionnel</label>
                    <input
                      type="number"
                      min="0"
                      value={form.promotionalPrice}
                      onChange={(e) => setForm({ ...form, promotionalPrice: e.target.value })}
                      placeholder="0"
                      className="input w-full h-9"
                    />
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="text-[11px] font-medium text-text-secondary dark:text-neutral-400">Devise</label>
                    <select
                      value={form.currency}
                      onChange={(e) => setForm({ ...form, currency: e.target.value })}
                      className="input w-full h-9"
                    >
                      <option value="XOF">XOF (FCFA)</option>
                      <option value="EUR">EUR</option>
                      <option value="USD">USD</option>
                    </select>
                  </div>
                </div>

                {/* Segment + Type client */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="flex flex-col gap-1">
                    <label className="text-[11px] font-medium text-text-secondary dark:text-neutral-400">Segment cible</label>
                    <select
                      value={form.targetSegment}
                      onChange={(e) => setForm({ ...form, targetSegment: e.target.value })}
                      className="input w-full h-9"
                    >
                      <option value="">Sélectionner</option>
                      <option value="MASS_MARKET">Grand public</option>
                      <option value="YOUTH">Jeunes</option>
                      <option value="BUSINESS">Entreprises</option>
                      <option value="PREMIUM">Premium</option>
                    </select>
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="text-[11px] font-medium text-text-secondary dark:text-neutral-400">Type client</label>
                    <select
                      value={form.customerType}
                      onChange={(e) => setForm({ ...form, customerType: e.target.value })}
                      className="input w-full h-9"
                    >
                      <option value="">Sélectionner</option>
                      <option value="PREPAID">Prépayé</option>
                      <option value="POSTPAID">Postpayé</option>
                      <option value="HYBRID">Hybride</option>
                    </select>
                  </div>
                </div>

                {/* Mentions légales */}
                <div className="flex flex-col gap-1">
                  <label className="text-[11px] font-medium text-text-secondary dark:text-neutral-400">Mentions légales</label>
                  <input
                    value={form.legalMentions}
                    onChange={(e) => setForm({ ...form, legalMentions: e.target.value })}
                    placeholder="Conditions et restrictions"
                    className="input w-full h-9"
                  />
                </div>
              </div>

              {/* Footer */}
              <div className="flex items-center justify-end gap-2 px-5 py-3 border-t border-border dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-800/30">
                <button
                  type="button"
                  onClick={() => { setShowModal(false); resetForm(); }}
                  className="tertiary-icon px-3 py-2 active-scale"
                >
                  <p className="text-sm font-medium">Annuler</p>
                </button>
                <button
                  type="submit"
                  disabled={creating}
                  className="primary-icon px-5 py-2 active-scale disabled:opacity-60"
                >
                  <span className="flex items-center gap-2">
                    {creating && (
                      <svg className="size-4 animate-spin" viewBox="0 0 16 16" fill="none">
                        <path d="M8 1.5v3M8 11.5v3M1.5 8h3M11.5 8h3M3.4 3.4l2.12 2.12M10.48 10.48l2.12 2.12M3.4 12.6l2.12-2.12M10.48 5.52l2.12-2.12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                      </svg>
                    )}
                    <p className="text-sm font-medium">
                      {creating ? "Enregistrement..." : "Enregistrer"}
                    </p>
                  </span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ===== MODAL DÉTAIL ===== */}
      {detailOffer && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm px-4"
          onClick={(e) => { if (e.target === e.currentTarget) setDetailOffer(null); }}
        >
          <div className="bg-white dark:bg-neutral-900 border border-border dark:border-neutral-800 rounded-2xl shadow-xl w-full max-w-md overflow-hidden">
            <div className="flex items-center justify-between px-5 py-3 border-b border-border dark:border-neutral-800">
              <h2 className="text-base font-bold text-black dark:text-white">Détails de l&apos;offre</h2>
              <button
                onClick={() => setDetailOffer(null)}
                className="p-1.5 rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors cursor-pointer"
              >
                <svg className="size-4 text-neutral-500" viewBox="0 0 16 16" fill="none">
                  <path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                </svg>
              </button>
            </div>
            <div className="px-5 py-4 flex flex-col gap-4 max-h-[60vh] overflow-y-auto">
              <div>
                <p className="text-sm font-bold text-black dark:text-white">{detailOffer.name}</p>
                <p className="text-xs text-text-secondary dark:text-neutral-500 mt-0.5">{detailOffer.shortDescription || ""}</p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-0.5">
                  <p className="text-[11px] text-text-secondary dark:text-neutral-500">Statut</p>
                  <span className="inline-flex items-center w-fit px-2 py-0.5 text-[11px] font-medium bg-black text-white dark:bg-white dark:text-black" style={{ borderRadius: 4 }}>
                    {ts(detailOffer.status)}
                  </span>
                </div>
                <div className="flex flex-col gap-0.5">
                  <p className="text-[11px] text-text-secondary dark:text-neutral-500">Score qualité</p>
                  <p className="text-sm font-bold text-black dark:text-white">{detailOffer.qualityScore}%</p>
                </div>
                <div className="flex flex-col gap-0.5">
                  <p className="text-[11px] text-text-secondary dark:text-neutral-500">Prix promotionnel</p>
                  <p className="text-sm font-bold text-black dark:text-white">
                    {detailOffer.promotionalPrice ? `${detailOffer.promotionalPrice.toLocaleString("fr-FR")} ${detailOffer.currency}` : "Non défini"}
                  </p>
                </div>
                <div className="flex flex-col gap-0.5">
                  <p className="text-[11px] text-text-secondary dark:text-neutral-500">Version</p>
                  <p className="text-sm font-bold text-black dark:text-white">v{detailOffer.currentVersion}</p>
                </div>
                <div className="flex flex-col gap-0.5">
                  <p className="text-[11px] text-text-secondary dark:text-neutral-500">Segment</p>
                  <p className="text-sm font-bold text-black dark:text-white">{detailOffer.targetSegment || "Non défini"}</p>
                </div>
                <div className="flex flex-col gap-0.5">
                  <p className="text-[11px] text-text-secondary dark:text-neutral-500">Type client</p>
                  <p className="text-sm font-bold text-black dark:text-white">{detailOffer.customerType || "Non défini"}</p>
                </div>
                <div className="flex flex-col gap-0.5">
                  <p className="text-[11px] text-text-secondary dark:text-neutral-500">Créée le</p>
                  <p className="text-sm font-bold text-black dark:text-white">{formatDate(detailOffer.createdAt)}</p>
                </div>
                <div className="flex flex-col gap-0.5">
                  <p className="text-[11px] text-text-secondary dark:text-neutral-500">Modifiée le</p>
                  <p className="text-sm font-bold text-black dark:text-white">{formatDate(detailOffer.updatedAt)}</p>
                </div>
              </div>

              {detailOffer.longDescription && (
                <div className="flex flex-col gap-0.5">
                  <p className="text-[11px] text-text-secondary dark:text-neutral-500">Description complète</p>
                  <p className="text-sm text-black dark:text-white">{detailOffer.longDescription}</p>
                </div>
              )}

              {detailOffer.legalMentions && (
                <div className="flex flex-col gap-0.5">
                  <p className="text-[11px] text-text-secondary dark:text-neutral-500">Mentions légales</p>
                  <p className="text-xs text-text-secondary dark:text-neutral-400">{detailOffer.legalMentions}</p>
                </div>
              )}
            </div>
            <div className="flex items-center justify-end gap-2 px-5 py-3 border-t border-border dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-800/30">
              <button
                onClick={() => { setTransitionOffer(detailOffer); setDetailOffer(null); }}
                className="secondary-icon px-3 py-2 active-scale"
              >
                <span className="flex items-center gap-1.5">
                  <svg className="size-3.5" viewBox="0 0 16 16" fill="none">
                    <path d="M3 8h10M10 5l3 3-3 3" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                  <p className="text-sm font-medium">Transition</p>
                </span>
              </button>
              <button
                onClick={() => { openEditModal(detailOffer); setDetailOffer(null); }}
                className="secondary-icon px-3 py-2 active-scale"
              >
                <span className="flex items-center gap-1.5">
                  <svg className="size-3.5" viewBox="0 0 16 16" fill="none">
                    <path d="M11.5 1.5l3 3-9 9H2.5v-3l9-9z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" />
                  </svg>
                  <p className="text-sm font-medium">Modifier</p>
                </span>
              </button>
              <button
                onClick={() => setDetailOffer(null)}
                className="tertiary-icon px-3 py-2 active-scale"
              >
                <p className="text-sm font-medium">Fermer</p>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ===== MODAL SUPPRESSION ===== */}
      {deleteTarget && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm px-4"
          onClick={(e) => { if (e.target === e.currentTarget) setDeleteTarget(null); }}
        >
          <div className="bg-white dark:bg-neutral-900 border border-border dark:border-neutral-800 rounded-2xl shadow-xl w-full max-w-sm overflow-hidden">
            <div className="px-5 py-5 flex flex-col items-center gap-3 text-center">
              <div className="size-12 rounded-full bg-red-50 dark:bg-red-900/20 flex items-center justify-center">
                <svg className="size-6 text-red-600 dark:text-red-400" viewBox="0 0 16 16" fill="none">
                  <path d="M3 4h10M6 4V3a1 1 0 011-1h2a1 1 0 011 1v1M5 4v9a1 1 0 001 1h4a1 1 0 001-1V4" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </div>
              <div>
                <p className="text-sm font-bold text-black dark:text-white">Supprimer cette offre ?</p>
                <p className="text-xs text-text-secondary dark:text-neutral-500 mt-1">
                  <span className="font-semibold text-black dark:text-white">{deleteTarget.name}</span> sera supprimée définitivement.
                </p>
              </div>
            </div>
            <div className="flex items-center justify-center gap-2 px-5 py-3 border-t border-border dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-800/30">
              <button
                onClick={() => setDeleteTarget(null)}
                className="tertiary-icon px-4 py-2 active-scale"
              >
                <p className="text-sm font-medium">Annuler</p>
              </button>
              <button
                onClick={handleDelete}
                disabled={deleting}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white text-sm font-medium active-scale disabled:opacity-60 transition-colors cursor-pointer"
                style={{ borderRadius: 7 }}
              >
                {deleting ? "Suppression..." : "Supprimer"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
