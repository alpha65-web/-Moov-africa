"use client";

import { useEffect, useState, useRef, useMemo } from "react";
import api, { apiError } from "@/lib/api";
import { searchKeyHandler } from "@/lib/search";
import { usePermissions, PERM } from "@/lib/permissions";
import type { Campaign, Offer } from "@/lib/types";
import toast from "react-hot-toast";
import { useTranslations } from "next-intl";

const STATUS_STYLES: Record<string, string> = {
  DRAFT: "bg-neutral-100 text-neutral-600 dark:bg-neutral-800 dark:text-neutral-400",
  SCHEDULED: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
  PUBLISHED: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400",
  COMPLETED: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400",
  CANCELLED: "bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400",
};

// Les neuf valeurs de l'enum ChannelType cote serveur. La liste s'arretait a cinq,
// alors que des campagnes diffusent sur Facebook et LinkedIn : ces canaux etaient
// absents du filtre et leur libelle ne se resolvait pas.
const CHANNEL_LIST = ["SMS", "EMAIL", "PUSH_NOTIFICATION", "SOCIAL_MEDIA", "USSD",
  "FACEBOOK", "INSTAGRAM", "LINKEDIN", "PARTNER_SITE"];

const EMPTY_FORM = {
  name: "",
  offerId: "",
  message: "",
  channelType: "SMS",
  scheduledAt: "",
};

const PER_PAGE = 10;

function Skeleton({ className }: { className: string }) {
  return <div className={`rounded-lg bg-neutral-100 dark:bg-neutral-800 animate-pulse ${className}`} />;
}

export default function CampaignsPage() {
  const t = useTranslations("campaigns");
  // CampaignController exige CAMPAIGN_MANAGE sur la totalite de ses endpoints,
  // lecture comprise. Un compte sans cette permission qui atteint l'ecran par
  // son URL ne doit pas y trouver des actions qui echoueront toutes.
  const { has } = usePermissions();
  const canManage = has(PERM.CAMPAIGN_MANAGE);
  const tc = useTranslations("common");

  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [offers, setOffers] = useState<Offer[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [filterChannel, setFilterChannel] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [page, setPage] = useState(1);

  const [showModal, setShowModal] = useState(false);
  const [creating, setCreating] = useState(false);
  const [editingCampaign, setEditingCampaign] = useState<Campaign | null>(null);
  const [form, setForm] = useState({ ...EMPTY_FORM });
  const modalRef = useRef<HTMLDivElement>(null);

  const [detailCampaign, setDetailCampaign] = useState<Campaign | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Campaign | null>(null);
  const [publishingId, setPublishingId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);

  const isEditing = !!editingCampaign;

  useEffect(() => { loadCampaigns(); loadOffers(); }, []);

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

  useEffect(() => { setPage(1); }, [search, filterStatus, filterChannel, dateFrom, dateTo]);

  async function loadCampaigns() {
    try { const { data } = await api.get("/campaigns/mine"); setCampaigns(data); }
    catch (e) { toast.error(apiError(e, tc("errors.load"))); }
    finally { setLoading(false); }
  }

  async function loadOffers() {
    try {
      // GET /offers renvoie un Page<OfferResponse>, pas un tableau nu.
      const { data } = await api.get("/offers", { params: { size: 500 } });
      setOffers(Array.isArray(data) ? data : data.content ?? []);
    }
    catch { /* */ }
  }

  function resetForm() { setForm({ ...EMPTY_FORM }); setEditingCampaign(null); }
  function openCreateModal() { resetForm(); setShowModal(true); }

  function openEditModal(c: Campaign) {
    setEditingCampaign(c);
    setForm({
      name: c.name, offerId: c.offerId || "",
      message: c.channels?.[0]?.message || "",
      channelType: c.channels?.[0]?.channelType || "SMS",
      scheduledAt: c.scheduledAt || "",
    });
    setShowModal(true); setOpenMenuId(null);
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (creating) return;
    setCreating(true);
    try {
      const payload = {
        name: form.name, offerId: form.offerId || null,
        scheduledAt: form.scheduledAt || null,
        channels: [{ channelType: form.channelType, message: form.message }],
      };
      if (isEditing) {
        await api.put(`/campaigns/${editingCampaign!.id}`, payload);
        toast.success(t("messages.updated"));
      } else {
        await api.post("/campaigns", payload);
        toast.success(t("messages.created"));
      }
      setShowModal(false); resetForm(); loadCampaigns();
    } catch (e) {
      toast.error(apiError(e, isEditing ? tc("errors.update") : tc("errors.create")));
    } finally { setCreating(false); }
  }

  /**
   * Diffuse la campagne sans attendre son échéance.
   *
   * Une campagne créée sans date planifiée restait en brouillon sans qu'aucun
   * geste de l'interface puisse la mettre en ligne : il fallait la rouvrir pour
   * lui donner une échéance, puis attendre le passage du planificateur.
   *
   * Le serveur refuse la diffusion si l'offre promue n'est pas publiée — son
   * message est affiché tel quel, car c'est lui qui explique pourquoi.
   */
  async function publishNow(campaign: Campaign) {
    if (publishingId) return;
    setPublishingId(campaign.id);
    setOpenMenuId(null);
    try {
      await api.post(`/campaigns/${campaign.id}/publish`);
      toast.success(t("messages.published"));
      loadCampaigns();
    } catch (e) {
      toast.error(apiError(e, tc("errors.action")));
    } finally {
      setPublishingId(null);
    }
  }

  async function handleDelete() {
    if (!deleteTarget || deleting) return;
    setDeleting(true);
    try { await api.delete(`/campaigns/${deleteTarget.id}`); toast.success(t("messages.deleted")); loadCampaigns(); }
    catch (e) { toast.error(apiError(e, tc("errors.delete"))); }
    finally { setDeleting(false); setDeleteTarget(null); }
  }

  function formatDate(date: string | null) {
    if (!date) return "—";
    return new Date(date).toLocaleDateString(undefined, { day: "2-digit", month: "short", year: "numeric" });
  }

  const filtered = campaigns.filter((c) => {
    if (search && !c.name.toLowerCase().includes(search.toLowerCase())) return false;
    if (filterStatus && c.status !== filterStatus) return false;
    if (filterChannel && !c.channels.some((ch) => ch.channelType === filterChannel)) return false;
    // La periode porte sur la date de creation, seule date renseignee quel que
    // soit le statut : scheduledAt reste vide sur les brouillons.
    if (dateFrom && new Date(c.createdAt) < new Date(dateFrom)) return false;
    if (dateTo) {
      const to = new Date(dateTo);
      to.setHours(23, 59, 59, 999);
      if (new Date(c.createdAt) > to) return false;
    }
    return true;
  });

  const totalPages = Math.ceil(filtered.length / PER_PAGE);
  const paginated = filtered.slice((page - 1) * PER_PAGE, page * PER_PAGE);

  /**
   * Diffusion par canal, recalculee sur les campagnes reellement enregistrees.
   *
   * Un canal n'apparait que s'il a servi au moins une fois : lister les neuf
   * canaux possibles avec des zeros ferait passer pour une absence de resultat
   * ce qui n'est qu'une absence d'usage.
   */
  const channelStats = useMemo(() => {
    const byChannel = new Map<string, { channel: string; total: number; sent: number; scheduled: number; lastSent: string | null }>();

    for (const campaign of campaigns) {
      for (const channel of campaign.channels ?? []) {
        const row = byChannel.get(channel.channelType)
          ?? { channel: channel.channelType, total: 0, sent: 0, scheduled: 0, lastSent: null };
        row.total += 1;
        if (channel.sentAt) {
          row.sent += 1;
          if (!row.lastSent || new Date(channel.sentAt) > new Date(row.lastSent)) {
            row.lastSent = channel.sentAt;
          }
        } else if (campaign.status === "SCHEDULED") {
          row.scheduled += 1;
        }
        byChannel.set(channel.channelType, row);
      }
    }

    return [...byChannel.values()].sort((a, b) => b.total - a.total);
  }, [campaigns]);

  const stats = {
    total: campaigns.length,
    scheduled: campaigns.filter((c) => c.status === "SCHEDULED").length,
    published: campaigns.filter((c) => c.status === "PUBLISHED").length,
    done: campaigns.filter((c) => c.status === "COMPLETED").length,
  };

  const cardData = [
    { key: "total", count: stats.total, label: t("stats.total"), link: t("stats.viewAll"), filterValue: "", color: "text-blue-600 dark:text-blue-400", bg: "bg-blue-100 dark:bg-blue-900/30", icon: (
      <svg className="size-6" viewBox="0 0 24 24" fill="none"><path d="M3 11V9a1 1 0 01.6-.9l8-4a1 1 0 01.8 0l8 4a1 1 0 01.6.9v2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /><path d="M3 11v4l9 5 9-5v-4" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" /><path d="M21 11l-9 5-9-5" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" /></svg>
    ) },
    { key: "scheduled", count: stats.scheduled, label: t("stats.scheduled"), link: t("stats.viewScheduled"), filterValue: "SCHEDULED", color: "text-primary", bg: "bg-primary/10", icon: (
      <svg className="size-6" viewBox="0 0 24 24" fill="none"><rect x="3" y="4" width="18" height="17" rx="2" stroke="currentColor" strokeWidth="1.5" /><path d="M3 9h18" stroke="currentColor" strokeWidth="1.5" /><path d="M8 2v4M16 2v4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" /><circle cx="16" cy="16" r="4" stroke="currentColor" strokeWidth="1.5" /><path d="M16 14.5v2l1 1" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" /></svg>
    ) },
    { key: "published", count: stats.published, label: t("stats.active"), link: t("stats.viewActive"), filterValue: "PUBLISHED", color: "text-emerald-600 dark:text-emerald-400", bg: "bg-emerald-100 dark:bg-emerald-900/30", icon: (
      <svg className="size-6" viewBox="0 0 24 24" fill="none"><path d="M22 2L11 13" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /><path d="M22 2l-7 20-4-9-9-4 20-7z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" /></svg>
    ) },
    { key: "done", count: stats.done, label: t("stats.done"), link: t("stats.viewDone"), filterValue: "COMPLETED", color: "text-purple-600 dark:text-purple-400", bg: "bg-purple-100 dark:bg-purple-900/30", icon: (
      <svg className="size-6" viewBox="0 0 24 24" fill="none"><path d="M12 2a5 5 0 015 5v1H7V7a5 5 0 015-5z" stroke="currentColor" strokeWidth="1.5" /><path d="M4 8h16v11a2 2 0 01-2 2H6a2 2 0 01-2-2V8z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" /><path d="M9 12l2 2 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
    ) },
  ];

  return (
    <div className="flex flex-col gap-6 pb-8">

      {/* ===== HEADER ===== */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-black dark:text-white">{t("title")}</h1>
          <p className="text-sm text-text-secondary dark:text-neutral-500 mt-1">{t("subtitle")}</p>
        </div>
        {/* Le chevron n'ouvrait qu'un menu reprenant a l'identique le bouton
            voisin : il n'apportait aucune action supplementaire. */}
        {canManage && (
          <button onClick={openCreateModal} className="primary-icon px-4 py-2.5 active-scale">
            <span className="flex items-center gap-2">
              <svg className="size-4" viewBox="0 0 16 16" fill="none">
                <path d="M8 3v10M3 8h10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
              <p className="text-sm font-medium">{t("newCampaign")}</p>
            </span>
          </button>
        )}
      </div>

      {/* ===== 4 STAT CARDS ===== */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {cardData.map((s) => (
          <button
            key={s.key}
            onClick={() => setFilterStatus(s.filterValue)}
            className="rounded-2xl border border-border dark:border-neutral-800 bg-white dark:bg-neutral-900 p-5 shadow-card text-left cursor-pointer transition-all duration-200 hover:shadow-lg hover:-translate-y-0.5"
          >
            <div className="flex items-center gap-3 mb-3">
              <div className={`rounded-xl p-2.5 ${s.bg} ${s.color}`}>{s.icon}</div>
              <span className="text-sm font-medium text-text-secondary dark:text-neutral-400">{s.label}</span>
            </div>
            {loading ? <Skeleton className="w-10 h-8 mb-2" /> : (
              <span className="text-3xl font-bold text-black dark:text-white tabular-nums block mb-2">{s.count}</span>
            )}
            <span className="text-xs font-medium text-primary flex items-center gap-1">
              {s.link}
              <svg className="size-3" viewBox="0 0 12 12" fill="none"><path d="M4.5 2.5l4 3.5-4 3.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
            </span>
          </button>
        ))}
      </div>

      {/* ===== RECHERCHE + FILTRES ===== */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-neutral-400" viewBox="0 0 16 16" fill="none">
            <circle cx="7" cy="7" r="5" stroke="currentColor" strokeWidth="1.3" />
            <path d="M11 11l3.5 3.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
          </svg>
          <input value={search} onChange={(e) => setSearch(e.target.value)} onKeyDown={searchKeyHandler(setSearch)} placeholder={t("searchPlaceholder")} className="input w-full h-10 pl-9" />
        </div>
        <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} className="input h-10 min-w-[140px]">
          <option value="">{t("filters.allStatuses")}</option>
          <option value="DRAFT">{t("status.DRAFT")}</option>
          <option value="SCHEDULED">{t("status.SCHEDULED")}</option>
          <option value="PUBLISHED">{t("status.PUBLISHED")}</option>
          <option value="COMPLETED">{t("status.COMPLETED")}</option>
          <option value="CANCELLED">{t("status.CANCELLED")}</option>
        </select>
        <select value={filterChannel} onChange={(e) => setFilterChannel(e.target.value)} className="input h-10 min-w-[140px]">
          <option value="">{t("filters.allChannels")}</option>
          {CHANNEL_LIST.map((ch) => <option key={ch} value={ch}>{t(`channels.${ch}`)}</option>)}
        </select>
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium text-text-secondary dark:text-neutral-500">{t("filters.period")}</span>
          <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="input h-10" />
          <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="input h-10" />
        </div>
      </div>

      {/* ===== TABLEAU ===== */}
      <div className="rounded-2xl border border-border dark:border-neutral-800 bg-white dark:bg-neutral-900 shadow-card overflow-hidden">
        <div className="hidden md:grid grid-cols-[1.3fr_1fr_100px_120px_110px_60px] gap-4 px-6 py-3 bg-primary dark:bg-primary/90 rounded-t-2xl">
          {[t("columns.name"), t("columns.channel"), t("columns.status"), t("columns.scheduled"), t("columns.created"), t("columns.actions")].map((col, i) => (
            <span key={i} className={`text-[11px] font-semibold uppercase tracking-wider text-white flex items-center gap-1 ${i === 5 ? "justify-end" : ""}`}>
              {col}
              {i < 5 && <svg className="size-3 opacity-60" viewBox="0 0 12 12" fill="none"><path d="M4 5l2-2 2 2M4 7l2 2 2-2" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" /></svg>}
            </span>
          ))}
        </div>

        {loading ? (
          <div className="px-6 py-4 flex flex-col gap-1">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="hidden md:grid grid-cols-[1.3fr_1fr_100px_120px_110px_60px] gap-4 items-center py-3.5">
                <Skeleton className="w-32 h-4" /><Skeleton className="w-14 h-5 !rounded-md" /><Skeleton className="w-16 h-5 !rounded-md" /><Skeleton className="w-20 h-4" /><Skeleton className="w-16 h-4" /><Skeleton className="w-6 h-6 ml-auto" />
              </div>
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="px-6 py-16 text-center">
            <div className="flex flex-col items-center gap-5">
              <svg className="size-36" viewBox="0 0 160 140" fill="none">
                {/* Nuages décoratifs */}
                <ellipse cx="30" cy="45" rx="12" ry="5" className="fill-blue-100/60 dark:fill-blue-900/15" />
                <ellipse cx="135" cy="35" rx="10" ry="4" className="fill-blue-100/50 dark:fill-blue-900/10" />
                {/* Enveloppe - corps */}
                <path d="M35 65h90v50a5 5 0 01-5 5H40a5 5 0 01-5-5V65z" className="fill-sky-100 dark:fill-sky-900/20 stroke-sky-300 dark:stroke-sky-700/50" strokeWidth="1.5" />
                {/* Enveloppe - rabat arrière */}
                <path d="M35 65l45 28 45-28" className="fill-sky-50 dark:fill-sky-900/10 stroke-sky-300 dark:stroke-sky-700/50" strokeWidth="1.5" strokeLinejoin="round" />
                {/* Lettre qui sort */}
                <rect x="50" y="38" width="60" height="42" rx="4" className="fill-white dark:fill-neutral-800 stroke-sky-200 dark:stroke-sky-800/40" strokeWidth="1.5" />
                <path d="M58 50h44M58 58h30M58 66h20" className="stroke-sky-200 dark:stroke-sky-700/40" strokeWidth="2" strokeLinecap="round" />
                {/* Avion en papier */}
                <g className="text-blue-500 dark:text-blue-400">
                  <path d="M105 30l-18 12 5 3 13-15z" fill="currentColor" fillOpacity="0.2" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
                  <path d="M87 42l3 8 4-5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                  <path d="M105 30l-15 20" stroke="currentColor" strokeWidth="1.2" strokeDasharray="2 2" />
                </g>
                {/* Petits éléments déco */}
                <circle cx="28" cy="80" r="2.5" className="fill-primary/20" />
                <circle cx="132" cy="55" r="2" className="fill-emerald-400/25" />
                <circle cx="118" cy="25" r="1.5" className="fill-amber-400/30" />
                <path d="M42 30l1.5 3 3 .5-2 2.5.3 3.2-2.8-1.5-2.8 1.5.3-3.2-2-2.5 3-.5L42 30z" className="fill-amber-300/30 dark:fill-amber-400/15" />
              </svg>
              <div>
                <p className="text-base font-bold text-black dark:text-white">{t("emptyTitle")}</p>
                <p className="text-sm text-text-secondary dark:text-neutral-500 mt-2 max-w-md mx-auto leading-relaxed">{t("emptyDescription")}</p>
              </div>
              {canManage && (
              <button onClick={openCreateModal} className="primary-icon px-5 py-2.5 active-scale mt-1">
                <span className="flex items-center gap-2">
                  <svg className="size-4" viewBox="0 0 16 16" fill="none"><path d="M8 3v10M3 8h10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" /></svg>
                  <p className="text-sm font-medium">{t("createFirst")}</p>
                </span>
              </button>
              )}
            </div>
          </div>
        ) : (
          <div className="divide-y divide-border dark:divide-neutral-800">
            {paginated.map((c) => (
              <div key={c.id} className="grid grid-cols-1 md:grid-cols-[1.3fr_1fr_100px_120px_110px_60px] gap-2 md:gap-4 items-center px-6 py-3.5 hover:bg-neutral-50 dark:hover:bg-neutral-800/30 transition-colors cursor-pointer" onClick={() => setDetailCampaign(c)}>
                <p className="text-sm font-semibold text-black dark:text-white truncate">{c.name}</p>
                <div className="flex flex-wrap gap-1">
                  {c.channels.map((ch, i) => (
                    <span key={i} className="inline-flex items-center px-2 py-0.5 text-[11px] font-semibold rounded-md bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400">
                      {t(`channels.${ch.channelType}`)}
                    </span>
                  ))}
                </div>
                <span className={`inline-flex items-center w-fit px-2 py-0.5 text-[11px] font-semibold rounded-md ${STATUS_STYLES[c.status] ?? STATUS_STYLES.DRAFT}`}>
                  {t(`status.${c.status}`)}
                </span>
                <p className="text-xs text-text-secondary dark:text-neutral-400">{formatDate(c.scheduledAt)}</p>
                <p className="text-xs text-text-secondary dark:text-neutral-400">{formatDate(c.createdAt)}</p>
                <div className="flex justify-end relative" onClick={(e) => e.stopPropagation()}>
                  <button onClick={() => setOpenMenuId(openMenuId === c.id ? null : c.id)} className="p-1.5 rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors">
                    <svg className="size-5 text-neutral-500 dark:text-neutral-400" viewBox="0 0 16 16" fill="none"><circle cx="8" cy="3" r="1.2" fill="currentColor" /><circle cx="8" cy="8" r="1.2" fill="currentColor" /><circle cx="8" cy="13" r="1.2" fill="currentColor" /></svg>
                  </button>
                  {openMenuId === c.id && (
                    <div className="absolute right-0 top-full mt-1 z-40 bg-white dark:bg-neutral-800 border border-border dark:border-neutral-700 rounded-xl shadow-lg p-1 min-w-[150px] animate-fade-in">
                      <button onClick={() => { setDetailCampaign(c); setOpenMenuId(null); }} className="flex items-center gap-2 w-full px-3 py-2 text-sm text-black dark:text-white rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-700 transition-colors">
                        <svg className="size-4 text-neutral-500" viewBox="0 0 16 16" fill="none"><circle cx="8" cy="8" r="6.5" stroke="currentColor" strokeWidth="1.5" /><path d="M8 7v4M8 5.5v.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" /></svg>
                        {tc("status")}
                      </button>
                      {canManage && (
                      <>
                      <button onClick={() => openEditModal(c)} className="flex items-center gap-2 w-full px-3 py-2 text-sm text-black dark:text-white rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-700 transition-colors">
                        <svg className="size-4 text-neutral-500" viewBox="0 0 16 16" fill="none"><path d="M11.5 1.5l3 3-9 9H2.5v-3l9-9z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" /></svg>
                        {tc("edit")}
                      </button>
                      {/* Proposé sur les seuls statuts que le serveur accepte : une
                          campagne déjà en ligne, terminée ou annulée ne se diffuse
                          pas, et l'action serait refusée en 409. */}
                      {(c.status === "DRAFT" || c.status === "SCHEDULED") && (
                        <button
                          onClick={() => publishNow(c)}
                          disabled={publishingId === c.id}
                          className="flex items-center gap-2 w-full px-3 py-2 text-sm text-black dark:text-white rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-700 transition-colors disabled:opacity-50"
                        >
                          <svg className="size-4 text-emerald-600" viewBox="0 0 16 16" fill="none"><path d="M2 8l12-5.5L11 14l-3-4.5L2 8z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" /></svg>
                          {publishingId === c.id ? tc("saving") : t("publishNow")}
                        </button>
                      )}
                      <button onClick={() => { setDeleteTarget(c); setOpenMenuId(null); }} className="flex items-center gap-2 w-full px-3 py-2 text-sm text-red-600 dark:text-red-400 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors">
                        <svg className="size-4" viewBox="0 0 16 16" fill="none"><path d="M3 4h10M6 4V3a1 1 0 011-1h2a1 1 0 011 1v1M5 4v9a1 1 0 001 1h4a1 1 0 001-1V4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
                        {tc("delete")}
                      </button>
                      </>
                      )}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {filtered.length > PER_PAGE && (
          <div className="flex items-center justify-between px-6 py-3 border-t border-border dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-800/20">
            <span className="text-xs text-text-secondary dark:text-neutral-500 tabular-nums">
              {(page - 1) * PER_PAGE + 1}–{Math.min(page * PER_PAGE, filtered.length)} / {filtered.length}
            </span>
            <div className="flex items-center gap-1">
              <button onClick={() => setPage(Math.max(1, page - 1))} disabled={page === 1} className="size-8 rounded-lg border border-border dark:border-neutral-700 flex items-center justify-center text-xs text-text-secondary hover:bg-neutral-100 dark:hover:bg-neutral-800 disabled:opacity-40 transition-colors cursor-pointer disabled:cursor-not-allowed">
                <svg className="size-3.5" viewBox="0 0 12 12" fill="none"><path d="M7.5 2.5l-4 3.5 4 3.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
              </button>
              {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
                <button key={p} onClick={() => setPage(p)} className={`size-8 rounded-lg text-xs font-medium transition-colors cursor-pointer ${page === p ? "bg-primary text-white" : "border border-border dark:border-neutral-700 text-text-secondary hover:bg-neutral-100 dark:hover:bg-neutral-800"}`}>{p}</button>
              ))}
              <button onClick={() => setPage(Math.min(totalPages, page + 1))} disabled={page === totalPages} className="size-8 rounded-lg border border-border dark:border-neutral-700 flex items-center justify-center text-xs text-text-secondary hover:bg-neutral-100 dark:hover:bg-neutral-800 disabled:opacity-40 transition-colors cursor-pointer disabled:cursor-not-allowed">
                <svg className="size-3.5" viewBox="0 0 12 12" fill="none"><path d="M4.5 2.5l4 3.5-4 3.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ===== STATISTIQUES DE DIFFUSION PAR CANAL =====
          Le cahier des charges (l. 107) confie au community manager le « suivi des
          statistiques de diffusion par canal ». L'ecran n'en comptait aucune : il
          n'affichait que des totaux par statut de campagne, et le canal n'etait
          qu'un critere de filtrage.

          Les chiffres ci-dessous sont recalcules a partir des campagnes reelles.
          Ils portent sur ce que la plateforme execute effectivement — combien de
          campagnes par canal, combien sont parties, combien attendent leur
          echeance, et quand la derniere est partie. Les vues, clics et taux
          d'engagement ne figurent volontairement pas : ils supposent un
          raccordement aux interfaces des reseaux sociaux, dont la plateforme ne
          dispose pas. Les afficher reviendrait a inventer des chiffres.
      */}
      {!loading && channelStats.length > 0 && (
        <div className="rounded-2xl border border-border dark:border-neutral-800 bg-white dark:bg-neutral-900 shadow-card overflow-hidden">
          <div className="px-6 py-4 border-b border-border dark:border-neutral-800">
            <h2 className="text-sm font-bold text-black dark:text-white uppercase tracking-wider">
              {t("channelStats.title")}
            </h2>
            <p className="text-xs text-text-secondary dark:text-neutral-500 mt-1">
              {t("channelStats.subtitle")}
            </p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-800/30">
                  {[t("channelStats.channel"), t("channelStats.campaigns"), t("channelStats.sent"),
                    t("channelStats.scheduled"), t("channelStats.lastSent")].map((col, i) => (
                    <th key={col} className={`px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-text-secondary dark:text-neutral-500 ${i === 0 ? "text-left" : "text-right"}`}>
                      {col}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border dark:divide-neutral-800">
                {channelStats.map((row) => (
                  <tr key={row.channel} className="hover:bg-neutral-50 dark:hover:bg-neutral-800/30 transition-colors">
                    <td className="px-4 py-3 font-medium text-black dark:text-white">
                      {t(`channels.${row.channel}`)}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums text-black dark:text-white">{row.total}</td>
                    <td className="px-4 py-3 text-right tabular-nums text-emerald-600 dark:text-emerald-400">{row.sent}</td>
                    <td className="px-4 py-3 text-right tabular-nums text-amber-600 dark:text-amber-400">{row.scheduled}</td>
                    <td className="px-4 py-3 text-right text-xs text-text-secondary dark:text-neutral-400">
                      {row.lastSent ? new Date(row.lastSent).toLocaleDateString() : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ===== MODAL CRÉATION / ÉDITION ===== */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm px-4" onClick={(e) => { if (e.target === e.currentTarget) { setShowModal(false); resetForm(); } }}>
          <div ref={modalRef} className="bg-white dark:bg-neutral-900 border border-border dark:border-neutral-800 rounded-2xl shadow-xl w-full max-w-md overflow-hidden animate-fade-in">
            <div className="flex items-center justify-between px-6 py-4 border-b border-border dark:border-neutral-800">
              <h2 className="text-base font-bold text-black dark:text-white">{isEditing ? t("editTitle") : t("createTitle")}</h2>
              <button onClick={() => { setShowModal(false); resetForm(); }} className="p-1.5 rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors cursor-pointer">
                <svg className="size-4 text-neutral-500" viewBox="0 0 16 16" fill="none"><path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" /></svg>
              </button>
            </div>
            <form onSubmit={handleCreate}>
              <div className="px-6 py-5 flex flex-col gap-4">
                <div className="flex flex-col gap-1.5">
                  <label className="text-[11px] font-semibold uppercase tracking-wider text-text-secondary dark:text-neutral-400">{t("form.name")}</label>
                  <input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="input w-full h-10" />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-[11px] font-semibold uppercase tracking-wider text-text-secondary dark:text-neutral-400">{t("form.offer")}</label>
                  <select value={form.offerId} onChange={(e) => setForm({ ...form, offerId: e.target.value })} className="input w-full h-10">
                    <option value="">{t("form.selectOffer")}</option>
                    {offers.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
                  </select>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="flex flex-col gap-1.5">
                    <label className="text-[11px] font-semibold uppercase tracking-wider text-text-secondary dark:text-neutral-400">{t("form.channel")}</label>
                    <select value={form.channelType} onChange={(e) => setForm({ ...form, channelType: e.target.value })} className="input w-full h-10">
                      {CHANNEL_LIST.map((ch) => <option key={ch} value={ch}>{t(`channels.${ch}`)}</option>)}
                    </select>
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label className="text-[11px] font-semibold uppercase tracking-wider text-text-secondary dark:text-neutral-400">{t("form.scheduledAt")}</label>
                    <input type="datetime-local" value={form.scheduledAt} onChange={(e) => setForm({ ...form, scheduledAt: e.target.value })} className="input w-full h-10" />
                  </div>
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-[11px] font-semibold uppercase tracking-wider text-text-secondary dark:text-neutral-400">{t("form.message")}</label>
                  <textarea value={form.message} onChange={(e) => setForm({ ...form, message: e.target.value })} rows={3} className="input w-full resize-none" />
                </div>
              </div>
              <div className="flex items-center justify-end gap-2 px-6 py-4 border-t border-border dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-800/30">
                <button type="button" onClick={() => { setShowModal(false); resetForm(); }} className="tertiary-icon px-4 py-2 active-scale">
                  <p className="text-sm font-medium">{tc("cancel")}</p>
                </button>
                <button type="submit" disabled={creating} className="primary-icon px-5 py-2 active-scale disabled:opacity-60">
                  <span className="flex items-center gap-2">
                    {creating && <div className="size-4 animate-spin rounded-full border-2 border-white border-t-transparent" />}
                    <p className="text-sm font-medium">{creating ? tc("saving") : tc("save")}</p>
                  </span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ===== MODAL DÉTAIL ===== */}
      {detailCampaign && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm px-4" onClick={(e) => { if (e.target === e.currentTarget) setDetailCampaign(null); }}>
          <div className="bg-white dark:bg-neutral-900 border border-border dark:border-neutral-800 rounded-2xl shadow-xl w-full max-w-md overflow-hidden animate-fade-in">
            <div className="flex items-center justify-between px-6 py-4 border-b border-border dark:border-neutral-800">
              <div className="flex items-center gap-3">
                <div className="size-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
                  <svg className="size-5" viewBox="0 0 16 16" fill="none"><path d="M2 3l6 4 6-4M2 3v10h12V3H2z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" /></svg>
                </div>
                <div>
                  <h2 className="text-base font-bold text-black dark:text-white">{detailCampaign.name}</h2>
                  <span className={`inline-flex items-center px-2 py-0.5 text-[11px] font-semibold rounded-md ${STATUS_STYLES[detailCampaign.status]}`}>
                    {t(`status.${detailCampaign.status}`)}
                  </span>
                </div>
              </div>
              <button onClick={() => setDetailCampaign(null)} className="p-1.5 rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors cursor-pointer">
                <svg className="size-4 text-neutral-500" viewBox="0 0 16 16" fill="none"><path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" /></svg>
              </button>
            </div>
            <div className="px-6 py-5 flex flex-col gap-5">
              <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col gap-1">
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-text-secondary dark:text-neutral-500">{t("columns.scheduled")}</p>
                  <p className="text-sm font-bold text-black dark:text-white">{formatDate(detailCampaign.scheduledAt)}</p>
                </div>
                <div className="flex flex-col gap-1">
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-text-secondary dark:text-neutral-500">{t("columns.created")}</p>
                  <p className="text-sm font-bold text-black dark:text-white">{formatDate(detailCampaign.createdAt)}</p>
                </div>
              </div>
              {detailCampaign.channels.length > 0 && (
                <div className="flex flex-col gap-2">
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-text-secondary dark:text-neutral-500">{t("columns.channel")}</p>
                  {detailCampaign.channels.map((ch, i) => (
                    <div key={i} className="p-3 rounded-xl bg-neutral-50 dark:bg-neutral-800/50 border border-border dark:border-neutral-700">
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="inline-flex items-center px-2 py-0.5 text-[11px] font-semibold rounded-md bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400">
                          {t(`channels.${ch.channelType}`)}
                        </span>
                        <span className="text-[10px] text-text-secondary dark:text-neutral-500">
                          {ch.sentAt ? formatDate(ch.sentAt) : t("notSent")}
                        </span>
                      </div>
                      {ch.message && <p className="text-xs text-black dark:text-white leading-relaxed">{ch.message}</p>}
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div className="flex items-center justify-end gap-2 px-6 py-4 border-t border-border dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-800/30">
              {canManage && (
              <button onClick={() => { openEditModal(detailCampaign); setDetailCampaign(null); }} className="secondary-icon px-4 py-2 active-scale">
                <span className="flex items-center gap-1.5">
                  <svg className="size-3.5" viewBox="0 0 16 16" fill="none"><path d="M11.5 1.5l3 3-9 9H2.5v-3l9-9z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" /></svg>
                  <p className="text-sm font-medium">{tc("edit")}</p>
                </span>
              </button>
              )}
              <button onClick={() => setDetailCampaign(null)} className="tertiary-icon px-4 py-2 active-scale">
                <p className="text-sm font-medium">{tc("close")}</p>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ===== MODAL SUPPRESSION ===== */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm px-4" onClick={(e) => { if (e.target === e.currentTarget) setDeleteTarget(null); }}>
          <div className="bg-white dark:bg-neutral-900 border border-border dark:border-neutral-800 rounded-2xl shadow-xl w-full max-w-sm overflow-hidden animate-fade-in">
            <div className="px-6 py-6 flex flex-col items-center gap-4 text-center">
              <div className="size-14 rounded-2xl bg-red-50 dark:bg-red-900/20 flex items-center justify-center">
                <svg className="size-7 text-red-600 dark:text-red-400" viewBox="0 0 16 16" fill="none"><path d="M3 4h10M6 4V3a1 1 0 011-1h2a1 1 0 011 1v1M5 4v9a1 1 0 001 1h4a1 1 0 001-1V4" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" /></svg>
              </div>
              <div>
                <p className="text-sm font-bold text-black dark:text-white">{t("messages.deleteConfirm")}</p>
                <p className="text-xs text-text-secondary dark:text-neutral-500 mt-1.5">
                  <span className="font-semibold text-black dark:text-white">{deleteTarget.name}</span> — {t("messages.deleteWarning")}
                </p>
              </div>
            </div>
            <div className="flex items-center justify-center gap-2 px-6 py-4 border-t border-border dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-800/30">
              <button onClick={() => setDeleteTarget(null)} className="tertiary-icon px-4 py-2 active-scale"><p className="text-sm font-medium">{tc("cancel")}</p></button>
              <button onClick={handleDelete} disabled={deleting} className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white text-sm font-medium rounded-lg active-scale disabled:opacity-60 transition-colors cursor-pointer">
                {deleting ? tc("deleting") : tc("delete")}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
