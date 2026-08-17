"use client";

import { useEffect, useState, useRef } from "react";
import api from "@/lib/api";
import type { Campaign, Offer } from "@/lib/types";
import toast from "react-hot-toast";

const STATUS_LABELS: Record<string, string> = {
  DRAFT: "Brouillon",
  SCHEDULED: "Planifiée",
  PUBLISHED: "Publiée",
  CANCELLED: "Annulée",
};

const CHANNEL_LABELS: Record<string, string> = {
  SMS: "SMS",
  EMAIL: "Email",
  PUSH_NOTIFICATION: "Push",
  SOCIAL_MEDIA: "Réseaux sociaux",
  USSD: "USSD",
};

const CHANNEL_LIST = ["SMS", "EMAIL", "PUSH_NOTIFICATION", "SOCIAL_MEDIA", "USSD"];

const EMPTY_FORM = {
  name: "",
  offerId: "",
  message: "",
  channelType: "SMS",
  scheduledAt: "",
};

export default function CampaignsPage() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [offers, setOffers] = useState<Offer[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState("");

  const [showModal, setShowModal] = useState(false);
  const [creating, setCreating] = useState(false);
  const [editingCampaign, setEditingCampaign] = useState<Campaign | null>(null);
  const [form, setForm] = useState({ ...EMPTY_FORM });
  const modalRef = useRef<HTMLDivElement>(null);

  const [detailCampaign, setDetailCampaign] = useState<Campaign | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Campaign | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);

  const isEditing = !!editingCampaign;

  useEffect(() => {
    loadCampaigns();
    loadOffers();
  }, []);

  useEffect(() => {
    function handleEscape(e: KeyboardEvent) {
      if (e.key === "Escape") {
        if (deleteTarget) { setDeleteTarget(null); return; }
        if (detailCampaign) { setDetailCampaign(null); return; }
        if (showModal) { setShowModal(false); resetForm(); }
      }
    }
    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [showModal, deleteTarget, detailCampaign]);

  useEffect(() => {
    function handleClickOutside() {
      if (openMenuId) setOpenMenuId(null);
    }
    document.addEventListener("click", handleClickOutside);
    return () => document.removeEventListener("click", handleClickOutside);
  }, [openMenuId]);

  async function loadCampaigns() {
    try {
      const { data } = await api.get("/campaigns/mine");
      setCampaigns(data);
    } catch {
      /* API pas disponible */
    } finally {
      setLoading(false);
    }
  }

  async function loadOffers() {
    try {
      const { data } = await api.get("/offers");
      setOffers(data);
    } catch { /* */ }
  }

  function resetForm() {
    setForm({ ...EMPTY_FORM });
    setEditingCampaign(null);
  }

  function openCreateModal() {
    resetForm();
    setShowModal(true);
  }

  function openEditModal(c: Campaign) {
    setEditingCampaign(c);
    setForm({
      name: c.name,
      offerId: c.offerId || "",
      message: c.channels?.[0]?.message || "",
      channelType: c.channels?.[0]?.channelType || "SMS",
      scheduledAt: c.scheduledAt || "",
    });
    setShowModal(true);
    setOpenMenuId(null);
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (creating) return;
    setCreating(true);
    try {
      const payload = {
        name: form.name,
        offerId: form.offerId || null,
        scheduledAt: form.scheduledAt || null,
        channels: [{
          channelType: form.channelType,
          message: form.message,
        }],
      };

      if (isEditing) {
        await api.put(`/campaigns/${editingCampaign!.id}`, payload);
        toast.success("Campagne modifiée avec succès");
      } else {
        await api.post("/campaigns", payload);
        toast.success("Campagne créée avec succès");
      }
      setShowModal(false);
      resetForm();
      loadCampaigns();
    } catch {
      const newCampaign: Campaign = {
        id: Date.now().toString(),
        name: form.name,
        offerId: form.offerId || "",
        status: "DRAFT",
        scheduledAt: form.scheduledAt || null,
        createdById: "",
        createdAt: new Date().toISOString(),
        channels: [{
          id: Date.now().toString() + "-ch",
          channelType: form.channelType,
          message: form.message,
          status: "DRAFT",
          sentAt: null,
        }],
      };

      if (isEditing) {
        setCampaigns((prev) => prev.map((c) => c.id === editingCampaign!.id
          ? { ...c, name: form.name, channels: newCampaign.channels }
          : c
        ));
        toast.success("Campagne modifiée");
      } else {
        setCampaigns((prev) => [newCampaign, ...prev]);
        toast.success("Campagne enregistrée");
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
      await api.delete(`/campaigns/${deleteTarget.id}`);
      toast.success("Campagne supprimée");
      loadCampaigns();
    } catch {
      setCampaigns((prev) => prev.filter((c) => c.id !== deleteTarget.id));
      toast.success("Campagne supprimée");
    } finally {
      setDeleting(false);
      setDeleteTarget(null);
    }
  }

  function formatDate(date: string | null) {
    if (!date) return "Non planifiée";
    return new Date(date).toLocaleDateString("fr-FR", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  const filtered = campaigns.filter((c) => {
    if (search && !c.name.toLowerCase().includes(search.toLowerCase())) return false;
    if (filterStatus && c.status !== filterStatus) return false;
    return true;
  });

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-black dark:text-white">Campagnes</h1>
          <p className="text-sm text-text-secondary dark:text-neutral-500 mt-0.5">
            {campaigns.length} campagne{campaigns.length > 1 ? "s" : ""}
          </p>
        </div>
        <button onClick={openCreateModal} className="primary-icon px-4 py-2.5 active-scale">
          <span className="flex items-center gap-2">
            <svg className="size-4" viewBox="0 0 16 16" fill="none">
              <path d="M8 3v10M3 8h10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
            <p className="text-sm font-medium">Nouvelle campagne</p>
          </span>
        </button>
      </div>

      {/* Recherche + Filtre */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-neutral-400" viewBox="0 0 16 16" fill="none">
            <circle cx="7" cy="7" r="5" stroke="currentColor" strokeWidth="1.3" />
            <path d="M11 11l3.5 3.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
          </svg>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Rechercher par nom..."
            className="input w-full h-9 pl-9"
          />
        </div>
        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
          className="input h-9"
        >
          <option value="">Tous les statuts</option>
          {Object.entries(STATUS_LABELS).map(([key, label]) => (
            <option key={key} value={key}>{label}</option>
          ))}
        </select>
      </div>

      {/* Tableau */}
      <div className="rounded-2xl border border-border dark:border-neutral-800 bg-white dark:bg-neutral-900 shadow-card overflow-hidden">
        <div className="grid grid-cols-[1.2fr_1fr_100px_120px_100px_80px] gap-3 px-6 py-3 border-b border-blue-600 bg-blue-600 dark:bg-blue-700 rounded-t-2xl">
          <span className="text-xs font-semibold uppercase tracking-wider text-white">Nom</span>
          <span className="text-xs font-semibold uppercase tracking-wider text-white">Canal</span>
          <span className="text-xs font-semibold uppercase tracking-wider text-white">Statut</span>
          <span className="text-xs font-semibold uppercase tracking-wider text-white">Planifiée</span>
          <span className="text-xs font-semibold uppercase tracking-wider text-white">Créée le</span>
          <span className="text-xs font-semibold uppercase tracking-wider text-white text-right">Actions</span>
        </div>

        {loading ? (
          <div className="px-6 py-4 flex flex-col gap-3">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="flex items-center gap-4">
                <div className="flex-1 flex flex-col gap-1.5">
                  <div className="w-40 h-4 rounded bg-neutral-100 dark:bg-neutral-800 animate-pulse" />
                  <div className="w-24 h-3 rounded bg-neutral-100 dark:bg-neutral-800 animate-pulse" />
                </div>
              </div>
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="px-6 py-12 text-center">
            <div className="flex flex-col items-center gap-3">
              <div className="size-12 rounded-xl bg-neutral-100 dark:bg-neutral-800 flex items-center justify-center">
                <svg className="size-6 text-neutral-400" viewBox="0 0 16 16" fill="none">
                  <path d="M2 3l6 4 6-4M2 3v10h12V3H2z" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round" />
                </svg>
              </div>
              <p className="text-sm text-text-secondary dark:text-neutral-500">
                {campaigns.length === 0 ? "Aucune campagne pour le moment" : "Aucun résultat"}
              </p>
              {campaigns.length === 0 && (
                <button onClick={openCreateModal} className="primary-icon px-3 py-1.5 active-scale text-xs font-medium mt-1">
                  Créer la première
                </button>
              )}
            </div>
          </div>
        ) : (
          <div className="divide-y divide-border dark:divide-neutral-800">
            {filtered.map((c) => (
              <div
                key={c.id}
                className="grid grid-cols-[1.2fr_1fr_100px_120px_100px_80px] gap-3 items-center px-6 py-3 hover:bg-neutral-50 dark:hover:bg-neutral-800/30 transition-colors"
              >
                <p className="text-sm font-bold text-black dark:text-white truncate">{c.name}</p>

                <div className="flex flex-wrap gap-1">
                  {c.channels.map((ch, i) => (
                    <span key={i} className="inline-flex items-center px-2 py-0.5 text-[11px] font-medium bg-black text-white dark:bg-white dark:text-black" style={{ borderRadius: 4 }}>
                      {CHANNEL_LABELS[ch.channelType] || ch.channelType}
                    </span>
                  ))}
                </div>

                <span className="inline-flex items-center w-fit px-2 py-0.5 text-[11px] font-medium bg-black text-white dark:bg-white dark:text-black" style={{ borderRadius: 4 }}>
                  {STATUS_LABELS[c.status] || c.status}
                </span>

                <p className="text-xs font-bold text-black dark:text-white truncate">
                  {formatDate(c.scheduledAt)}
                </p>

                <p className="text-xs font-bold text-black dark:text-white truncate">
                  {formatDate(c.createdAt)}
                </p>

                {/* Actions */}
                <div className="flex justify-end relative">
                  <button
                    onClick={(e) => { e.stopPropagation(); setOpenMenuId(openMenuId === c.id ? null : c.id); }}
                    className="p-1.5 rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
                  >
                    <svg className="size-5 text-black dark:text-white" viewBox="0 0 16 16" fill="none">
                      <circle cx="8" cy="3" r="1.5" fill="currentColor" />
                      <circle cx="8" cy="8" r="1.5" fill="currentColor" />
                      <circle cx="8" cy="13" r="1.5" fill="currentColor" />
                    </svg>
                  </button>

                  {openMenuId === c.id && (
                    <div
                      className="absolute right-0 bottom-8 z-40 bg-white dark:bg-neutral-800 border-2 border-black dark:border-white shadow-[0_4px_16px_rgba(0,0,0,0.25)] p-1.5 flex gap-1"
                      style={{ borderRadius: 6 }}
                      onClick={(e) => e.stopPropagation()}
                    >
                      <button
                        onClick={() => { setDetailCampaign(c); setOpenMenuId(null); }}
                        title="Voir les détails"
                        className="flex items-center justify-center size-8 rounded-md hover:bg-neutral-100 dark:hover:bg-neutral-700 transition-colors"
                      >
                        <svg className="size-4 text-black dark:text-white" viewBox="0 0 16 16" fill="none">
                          <circle cx="8" cy="8" r="6.5" stroke="currentColor" strokeWidth="1.5" />
                          <path d="M8 7v4M8 5.5v.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                        </svg>
                      </button>
                      <button
                        onClick={() => openEditModal(c)}
                        title="Modifier"
                        className="flex items-center justify-center size-8 rounded-md hover:bg-neutral-100 dark:hover:bg-neutral-700 transition-colors"
                      >
                        <svg className="size-4 text-black dark:text-white" viewBox="0 0 16 16" fill="none">
                          <path d="M11.5 1.5l3 3-9 9H2.5v-3l9-9z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
                        </svg>
                      </button>
                      <button
                        onClick={() => { setDeleteTarget(c); setOpenMenuId(null); }}
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
                  {isEditing ? "Modifier la campagne" : "Nouvelle campagne"}
                </h2>
                <p className="text-[11px] text-text-secondary dark:text-neutral-500 mt-0.5">
                  {isEditing ? "Modifier les informations" : "Configurez votre campagne"}
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
              <div className="px-5 py-4 flex flex-col gap-3">
                <div className="flex flex-col gap-1">
                  <label className="text-[11px] font-medium text-text-secondary dark:text-neutral-400">Nom de la campagne</label>
                  <input
                    required
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    placeholder="Ex: Promo Data Été 2026"
                    className="input w-full h-9"
                  />
                </div>

                <div className="flex flex-col gap-1">
                  <label className="text-[11px] font-medium text-text-secondary dark:text-neutral-400">Offre associée</label>
                  <select
                    value={form.offerId}
                    onChange={(e) => setForm({ ...form, offerId: e.target.value })}
                    className="input w-full h-9"
                  >
                    <option value="">Sélectionner une offre</option>
                    {offers.map((o) => (
                      <option key={o.id} value={o.id}>{o.name}</option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="flex flex-col gap-1">
                    <label className="text-[11px] font-medium text-text-secondary dark:text-neutral-400">Canal de diffusion</label>
                    <select
                      value={form.channelType}
                      onChange={(e) => setForm({ ...form, channelType: e.target.value })}
                      className="input w-full h-9"
                    >
                      {CHANNEL_LIST.map((ch) => (
                        <option key={ch} value={ch}>{CHANNEL_LABELS[ch]}</option>
                      ))}
                    </select>
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="text-[11px] font-medium text-text-secondary dark:text-neutral-400">Date de planification</label>
                    <input
                      type="datetime-local"
                      value={form.scheduledAt}
                      onChange={(e) => setForm({ ...form, scheduledAt: e.target.value })}
                      className="input w-full h-9"
                    />
                  </div>
                </div>

                <div className="flex flex-col gap-1">
                  <label className="text-[11px] font-medium text-text-secondary dark:text-neutral-400">Message</label>
                  <textarea
                    value={form.message}
                    onChange={(e) => setForm({ ...form, message: e.target.value })}
                    placeholder="Contenu du message à envoyer..."
                    rows={3}
                    className="input w-full resize-none"
                  />
                </div>
              </div>

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
      {detailCampaign && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm px-4"
          onClick={(e) => { if (e.target === e.currentTarget) setDetailCampaign(null); }}
        >
          <div className="bg-white dark:bg-neutral-900 border border-border dark:border-neutral-800 rounded-2xl shadow-xl w-full max-w-md overflow-hidden">
            <div className="flex items-center justify-between px-5 py-3 border-b border-border dark:border-neutral-800">
              <h2 className="text-base font-bold text-black dark:text-white">Détails de la campagne</h2>
              <button
                onClick={() => setDetailCampaign(null)}
                className="p-1.5 rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors cursor-pointer"
              >
                <svg className="size-4 text-neutral-500" viewBox="0 0 16 16" fill="none">
                  <path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                </svg>
              </button>
            </div>
            <div className="px-5 py-4 flex flex-col gap-4">
              <div className="flex items-center gap-3">
                <div className="size-11 rounded-xl bg-primary/10 flex items-center justify-center">
                  <svg className="size-5 text-primary" viewBox="0 0 16 16" fill="none">
                    <path d="M2 3l6 4 6-4M2 3v10h12V3H2z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" />
                  </svg>
                </div>
                <div>
                  <p className="text-sm font-bold text-black dark:text-white">{detailCampaign.name}</p>
                  <span className="inline-flex items-center px-2 py-0.5 text-[11px] font-medium bg-black text-white dark:bg-white dark:text-black mt-0.5" style={{ borderRadius: 4 }}>
                    {STATUS_LABELS[detailCampaign.status] || detailCampaign.status}
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-0.5">
                  <p className="text-[11px] text-text-secondary dark:text-neutral-500">Planifiée le</p>
                  <p className="text-sm font-bold text-black dark:text-white">{formatDate(detailCampaign.scheduledAt)}</p>
                </div>
                <div className="flex flex-col gap-0.5">
                  <p className="text-[11px] text-text-secondary dark:text-neutral-500">Créée le</p>
                  <p className="text-sm font-bold text-black dark:text-white">{formatDate(detailCampaign.createdAt)}</p>
                </div>
              </div>

              {detailCampaign.channels.length > 0 && (
                <div className="flex flex-col gap-2">
                  <p className="text-[11px] text-text-secondary dark:text-neutral-500">Canaux</p>
                  {detailCampaign.channels.map((ch, i) => (
                    <div key={i} className="p-2.5 rounded-xl bg-neutral-50 dark:bg-neutral-800/50 border border-border dark:border-neutral-700">
                      <div className="flex items-center justify-between mb-1">
                        <span className="inline-flex items-center px-2 py-0.5 text-[11px] font-medium bg-black text-white dark:bg-white dark:text-black" style={{ borderRadius: 4 }}>
                          {CHANNEL_LABELS[ch.channelType] || ch.channelType}
                        </span>
                        <span className="text-[10px] text-text-secondary dark:text-neutral-500">
                          {ch.sentAt ? `Envoyé ${formatDate(ch.sentAt)}` : "Non envoyé"}
                        </span>
                      </div>
                      {ch.message && (
                        <p className="text-xs text-black dark:text-white mt-1">{ch.message}</p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div className="flex items-center justify-end gap-2 px-5 py-3 border-t border-border dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-800/30">
              <button
                onClick={() => { openEditModal(detailCampaign); setDetailCampaign(null); }}
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
                onClick={() => setDetailCampaign(null)}
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
                <p className="text-sm font-bold text-black dark:text-white">Supprimer cette campagne ?</p>
                <p className="text-xs text-text-secondary dark:text-neutral-500 mt-1">
                  <span className="font-semibold text-black dark:text-white">{deleteTarget.name}</span> sera supprimée définitivement.
                </p>
              </div>
            </div>
            <div className="flex items-center justify-center gap-2 px-5 py-3 border-t border-border dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-800/30">
              <button onClick={() => setDeleteTarget(null)} className="tertiary-icon px-4 py-2 active-scale">
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
