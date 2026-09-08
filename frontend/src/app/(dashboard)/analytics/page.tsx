"use client";

import { useEffect, useState, useMemo } from "react";
import api, { apiError } from "@/lib/api";
import toast from "react-hot-toast";
import { searchKeyHandler } from "@/lib/search";
import { usePermissions, PERM } from "@/lib/permissions";
import type { KpiEvent } from "@/lib/types";
import { useTranslations } from "next-intl";

/**
 * KpiEventListener n'emet que deux familles d'evenements :
 *   - OFFER_CREATED         a la creation d'une offre
 *   - STATUS_<OfferStatus>  a chaque changement de statut
 * Les cles ci-dessous reprennent ce vocabulaire ; toute autre serait morte.
 */
const TYPE_STYLES: Record<string, { badge: string; icon: string }> = {
  OFFER_CREATED: {
    badge: "bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-400",
    icon: "text-violet-600 dark:text-violet-400 bg-violet-100 dark:bg-violet-900/30",
  },
  STATUS_DRAFT: {
    badge: "bg-neutral-100 text-neutral-600 dark:bg-neutral-800 dark:text-neutral-400",
    icon: "text-neutral-600 dark:text-neutral-400 bg-neutral-100 dark:bg-neutral-800",
  },
  STATUS_IN_ENRICHMENT: {
    badge: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400",
    icon: "text-purple-600 dark:text-purple-400 bg-purple-100 dark:bg-purple-900/30",
  },
  STATUS_IN_VALIDATION: {
    badge: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
    icon: "text-amber-600 dark:text-amber-400 bg-amber-100 dark:bg-amber-900/30",
  },
  STATUS_VALIDATED: {
    badge: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
    icon: "text-blue-600 dark:text-blue-400 bg-blue-100 dark:bg-blue-900/30",
  },
  STATUS_PLANNED: {
    badge: "bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400",
    icon: "text-indigo-600 dark:text-indigo-400 bg-indigo-100 dark:bg-indigo-900/30",
  },
  STATUS_PUBLISHED: {
    badge: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400",
    icon: "text-emerald-600 dark:text-emerald-400 bg-emerald-100 dark:bg-emerald-900/30",
  },
  STATUS_SUSPENDED: {
    badge: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400",
    icon: "text-orange-600 dark:text-orange-400 bg-orange-100 dark:bg-orange-900/30",
  },
  STATUS_OBSOLETE: {
    badge: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
    icon: "text-red-600 dark:text-red-400 bg-red-100 dark:bg-red-900/30",
  },
  STATUS_WITHDRAWN: {
    badge: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
    icon: "text-red-600 dark:text-red-400 bg-red-100 dark:bg-red-900/30",
  },
  STATUS_ARCHIVED: {
    badge: "bg-neutral-100 text-neutral-500 dark:bg-neutral-800 dark:text-neutral-500",
    icon: "text-neutral-500 dark:text-neutral-500 bg-neutral-100 dark:bg-neutral-800",
  },
  // Mesures metier suivies via kpi_configs, distinctes des transitions de statut.
  TIME_TO_MARKET: {
    badge: "bg-cyan-100 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-400",
    icon: "text-cyan-600 dark:text-cyan-400 bg-cyan-100 dark:bg-cyan-900/30",
  },
  CAMPAIGN_SENT: {
    badge: "bg-pink-100 text-pink-700 dark:bg-pink-900/30 dark:text-pink-400",
    icon: "text-pink-600 dark:text-pink-400 bg-pink-100 dark:bg-pink-900/30",
  },
};

const CREATION_ICON = (
  <svg className="size-5" viewBox="0 0 20 20" fill="none"><path d="M10 4v12M4 10h12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" /></svg>
);

const TRANSITION_ICON = (
  <svg className="size-5" viewBox="0 0 20 20" fill="none"><path d="M4 10h12M12 6l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
);

const PUBLICATION_ICON = (
  <svg className="size-5" viewBox="0 0 20 20" fill="none"><path d="M10 2l2.5 5 5.5.8-4 3.9.9 5.3L10 14.5 5.1 17l.9-5.3-4-3.9 5.5-.8L10 2z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" /></svg>
);

const TYPE_ICONS: Record<string, React.ReactNode> = {
  OFFER_CREATED: CREATION_ICON,
  STATUS_PUBLISHED: PUBLICATION_ICON,
};

const DEFAULT_STYLE = {
  badge: "bg-neutral-100 text-neutral-600 dark:bg-neutral-800 dark:text-neutral-400",
  icon: "text-neutral-600 dark:text-neutral-400 bg-neutral-100 dark:bg-neutral-800",
};

/**
 * Libelle lisible d'un type d'evenement. Les cles connues sont traduites ;
 * un type inattendu est rendu tel quel plutot que d'afficher un chemin de cle.
 */
function eventLabel(type: string, t: (k: string) => string, has: (k: string) => boolean): string {
  const key = `eventTypes.${type}`;
  if (has(key)) return t(key);
  return type.replace(/^STATUS_/, "").replace(/_/g, " ").toLowerCase();
}

/**
 * Reponse de GET /exports/reconciliation.
 *
 * Le serveur ne renvoie pas le nom de l'offre : cet ecran charge deja la liste
 * des offres et resout l'identite lui-meme, ce qui evite au module de diffusion
 * d'interroger celui du cycle de vie.
 */
interface DiffusionRow {
  offerId: string;
  statusByTarget: Record<string, string>;
}

/** Les trois systemes destinataires, dans l'ordre du cahier des charges. */
const TARGET_SYSTEMS = ["CRM", "CALL_CENTER", "WEBSITE"] as const;

const DIFFUSION_STATUS_STYLES: Record<string, string> = {
  SUCCESS: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400",
  PENDING: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
  FAILED: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
  ABSENT: "bg-neutral-100 text-neutral-600 dark:bg-neutral-800 dark:text-neutral-400",
};

/** Reponse de GET /kpi/summary. */
interface KpiSummary {
  scope: "TEAM" | "SELF";
  trackedOffers: number;
  publishedOffers: number;
  ttmMedianMs: number | null;
  ttmAverageMs: number | null;
  ttmByOffer: { offerId: string; durationMs: number }[];
  stages: { stage: string; averageMs: number; count: number }[];
  bottleneckStage: string | null;
}

/**
 * Barres horizontales a serie unique.
 *
 * Une seule teinte : les barres comparent des grandeurs d'une meme mesure, la
 * couleur n'a donc aucune identite a porter et une palette categorielle serait
 * trompeuse. La valeur est inscrite au bout de chaque barre plutot que sur un
 * axe, parce qu'on en compare peu et qu'on veut les lire sans viser.
 */
function BarChart({
  rows,
  emphasis,
  emphasisLabel,
  format,
}: {
  rows: { key: string; label: string; value: number; hint?: string }[];
  emphasis?: string | null;
  emphasisLabel?: string;
  format: (value: number) => string;
}) {
  const max = Math.max(...rows.map((r) => r.value), 1);
  return (
    <div className="flex flex-col gap-3">
      {rows.map((row) => {
        const isEmphasis = emphasis != null && row.key === emphasis;
        return (
          <div key={row.key} className="flex flex-col gap-1" title={row.hint ?? `${row.label} : ${format(row.value)}`}>
            <div className="flex items-baseline justify-between gap-3">
              <span className="text-xs font-medium text-black dark:text-white truncate flex items-center gap-1.5">
                {row.label}
                {isEmphasis && emphasisLabel && (
                  <span className="shrink-0 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
                    {emphasisLabel}
                  </span>
                )}
              </span>
              <span className="text-xs font-semibold text-text-secondary dark:text-neutral-400 tabular-nums shrink-0">
                {format(row.value)}
              </span>
            </div>
            <div className="h-3 w-full rounded-sm bg-neutral-100 dark:bg-neutral-800 overflow-hidden">
              <div
                className="h-full rounded-r-[4px] bg-primary transition-all duration-700 ease-out"
                style={{ width: `${Math.max((row.value / max) * 100, 1.5)}%` }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}

const PER_PAGE = 10;

function Skeleton({ className }: { className: string }) {
  return <div className={`rounded-lg bg-neutral-100 dark:bg-neutral-800 animate-pulse ${className}`} />;
}

export default function AnalyticsPage() {
  const t = useTranslations("analytics");
  const tc = useTranslations("common");
  // Le perimetre equipe commande aussi ce rapprochement : l'analyste marketing,
  // qui n'a que ANALYTICS_VIEW, ne voit pas la diffusion des offres des autres.
  const { has } = usePermissions();
  const canSeeTeamScope = has(PERM.ANALYTICS_TEAM_VIEW);
  // Les etapes sont des statuts d'offre : on reutilise leurs libelles plutot
  // que d'afficher les constantes techniques du backend.
  const ts = useTranslations("offers.status");

  const [events, setEvents] = useState<KpiEvent[]>([]);
  // Indicateurs agreges par le serveur. Le perimetre (TEAM ou SELF) est decide
  // par le backend selon les permissions, jamais par un parametre de requete.
  const [summary, setSummary] = useState<KpiSummary | null>(null);
  const [offerNames, setOfferNames] = useState<Record<string, string>>({});
  /**
   * Rapprochement avec les systemes tiers, reserve a la vue transversale.
   *
   * Le cahier des charges (l. 106) confie ce rapprochement au chef de departement,
   * qui publie les offres et doit pouvoir constater lesquelles ne sont pas
   * arrivees a destination. Aucun ecran ne le lui permettait : la seule vue des
   * exports etait celle de l'administration, fermee par EXPORT_MANAGE.
   */
  const [diffusion, setDiffusion] = useState<DiffusionRow[]>([]);
  const [publishedOffers, setPublishedOffers] = useState<{ id: string; name: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterType, setFilterType] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [page, setPage] = useState(1);

  useEffect(() => { loadEvents(); }, []);
  useEffect(() => { setPage(1); }, [search, filterType, dateFrom, dateTo]);

  async function loadEvents() {
    try {
      // GET /kpi exige from et to (LocalDateTime ISO). Le filtrage fin reste cote client.
      const to = new Date();
      const from = new Date();
      from.setFullYear(from.getFullYear() - 1);
      const { data } = await api.get("/kpi", {
        params: { from: from.toISOString().slice(0, 19), to: to.toISOString().slice(0, 19), size: 500 },
      });
      setEvents(Array.isArray(data) ? data : data.content ?? []);

      const { data: agg } = await api.get("/kpi/summary", {
        params: { from: from.toISOString().slice(0, 19), to: to.toISOString().slice(0, 19) },
      });
      setSummary(agg);

      // Les indicateurs designent les offres par identifiant : un graphique doit
      // porter leur nom. La liste est deja ouverte a tous les roles qui accedent
      // a cet ecran, aucune permission supplementaire n'est requise.
      // Les offres sont desormais toujours chargees : elles nomment les barres du
      // Time To Market, et servent de reference au rapprochement ci-dessous — une
      // offre publiee absente des exports n'a jamais ete diffusee du tout.
      const { data: offers } = await api.get("/offers", { params: { size: 500 } });
      const list: { id: string; name: string; status: string }[] = offers.content ?? offers;
      setOfferNames(Object.fromEntries(list.map((o) => [o.id, o.name])));
      setPublishedOffers(list.filter((o) => o.status === "PUBLISHED").map((o) => ({ id: o.id, name: o.name })));
    } catch (e) { toast.error(apiError(e, tc("errors.load"))); }
    finally { setLoading(false); }
  }

  // Requete distincte : elle n'est meme pas emise pour un compte qui n'a pas la
  // vue transversale, plutot que d'etre emise puis refusee en 403.
  useEffect(() => {
    if (!canSeeTeamScope) return;
    let cancelled = false;
    api.get("/exports/reconciliation")
      .then(({ data }) => { if (!cancelled) setDiffusion(Array.isArray(data) ? data : []); })
      .catch(() => { if (!cancelled) setDiffusion([]); });
    return () => { cancelled = true; };
  }, [canSeeTeamScope]);

  /**
   * Etat de diffusion de chaque offre publiee, systeme par systeme.
   *
   * Le rapprochement se fait ici : une offre publiee qui n'apparait dans aucun
   * export est signalee ABSENT sur les trois systemes. C'est exactement le cas que
   * la plateforme produisait avant le branchement de la diffusion — la publication
   * n'ouvrait aucun export.
   */
  const reconciliation = useMemo(() => {
    const byOffer = new Map(diffusion.map((row) => [row.offerId, row.statusByTarget]));
    return publishedOffers.map((offer) => {
      const statuses = byOffer.get(offer.id) ?? {};
      const targets = TARGET_SYSTEMS.map((system) => ({
        system,
        status: statuses[system] ?? "ABSENT",
      }));
      return {
        ...offer,
        targets,
        complete: targets.every((target) => target.status === "SUCCESS"),
      };
    });
  }, [diffusion, publishedOffers]);

  const diffusionGaps = reconciliation.filter((row) => !row.complete);

  function formatDate(dateStr: string): string {
    const d = new Date(dateStr);
    return d.toLocaleDateString(undefined, { day: "2-digit", month: "2-digit", year: "numeric" }) + " " + d.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
  }

  function formatDuration(ms: number | null): string {
    if (ms === null || ms === undefined) return "—";
    if (ms < 1000) return t("durationMs", { ms });
    if (ms < 60000) return t("durationSec", { sec: (ms / 1000).toFixed(1) });
    return t("durationMin", { min: (ms / 60000).toFixed(1) });
  }

  const filtered = useMemo(() => {
    return events.filter((ev) => {
      if (filterType && ev.eventType !== filterType) return false;
      if (search) {
        const q = search.toLowerCase();
        if (!(ev.offerId || "").toLowerCase().includes(q) && !(ev.actorId || "").toLowerCase().includes(q) && !(ev.eventType || "").toLowerCase().includes(q)) return false;
      }
      if (dateFrom) {
        const from = new Date(dateFrom);
        if (new Date(ev.createdAt) < from) return false;
      }
      if (dateTo) {
        const to = new Date(dateTo);
        to.setHours(23, 59, 59, 999);
        if (new Date(ev.createdAt) > to) return false;
      }
      return true;
    });
  }, [events, filterType, search, dateFrom, dateTo]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PER_PAGE));
  const paginated = filtered.slice((page - 1) * PER_PAGE, page * PER_PAGE);

  const stats = useMemo(() => {
    const durations = events.filter((e) => e.durationMs !== null).map((e) => e.durationMs!);
    const avgDuration = durations.length > 0 ? Math.round(durations.reduce((a, b) => a + b, 0) / durations.length) : 0;
    const uniqueTypes = new Set(events.map((e) => e.eventType)).size;
    const offersTracked = new Set(events.map((e) => e.offerId)).size;
    return { totalEvents: events.length, avgDuration, uniqueTypes, offersTracked };
  }, [events]);

  const allTypes = [...new Set(events.map((e) => e.eventType))];

  const statCards = [
    {
      label: t("stats.totalEvents"), value: stats.totalEvents,
      color: "text-blue-600 dark:text-blue-400", bg: "bg-blue-100 dark:bg-blue-900/30",
      icon: (<svg className="size-6" viewBox="0 0 24 24" fill="none"><rect x="3" y="3" width="18" height="18" rx="3" stroke="currentColor" strokeWidth="1.5" /><path d="M7 17V13M12 17V9M17 17V7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" /></svg>),
    },
    {
      label: t("stats.avgDuration"), value: formatDuration(stats.avgDuration),
      color: "text-amber-600 dark:text-amber-400", bg: "bg-amber-100 dark:bg-amber-900/30",
      icon: (<svg className="size-6" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.5" /><path d="M12 7v5l3 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>),
    },
    {
      label: t("stats.uniqueTypes"), value: stats.uniqueTypes,
      color: "text-purple-600 dark:text-purple-400", bg: "bg-purple-100 dark:bg-purple-900/30",
      icon: (<svg className="size-6" viewBox="0 0 24 24" fill="none"><path d="M4 6h16M4 12h10M4 18h14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" /></svg>),
    },
    {
      label: t("stats.offersTracked"), value: stats.offersTracked,
      color: "text-emerald-600 dark:text-emerald-400", bg: "bg-emerald-100 dark:bg-emerald-900/30",
      icon: (<svg className="size-6" viewBox="0 0 24 24" fill="none"><path d="M12 2l3 6h6l-5 4 2 6-6-3-6 3 2-6-5-4h6l3-6z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" /></svg>),
    },
  ];

  return (
    <div className="flex flex-col gap-6 pb-8">

      {/* ===== HEADER ===== */}
      <div>
        <h1 className="text-2xl font-bold text-black dark:text-white">{t("title")}</h1>
        <p className="text-sm text-text-secondary dark:text-neutral-500 mt-1">{t("subtitle")}</p>
      </div>

      {/* ===== 4 STAT CARDS ===== */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {statCards.map((card) => (
          <div key={card.label} className="rounded-2xl border border-border dark:border-neutral-800 bg-white dark:bg-neutral-900 p-5 shadow-card">
            <div className="flex items-center gap-3 mb-3">
              <div className={`rounded-xl p-2.5 ${card.bg} ${card.color}`}>{card.icon}</div>
              <span className="text-sm font-medium text-text-secondary dark:text-neutral-400">{card.label}</span>
            </div>
            {loading ? <Skeleton className="w-12 h-8 mb-2" /> : (
              <span className="text-3xl font-bold text-black dark:text-white tabular-nums block">{card.value}</span>
            )}
          </div>
        ))}
      </div>

      {/* ===== INDICATEURS DU CAHIER DES CHARGES ===== */}
      {/* Chaque valeur est agregee par le serveur a partir des transitions
          reellement enregistrees. Une periode sans activite affiche l'absence de
          donnee : rien n'est estime pour remplir un graphique. */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

        <div className="rounded-2xl border border-border dark:border-neutral-800 bg-white dark:bg-neutral-900 p-5 shadow-card flex flex-col gap-4">
          <div>
            <h2 className="text-sm font-bold text-black dark:text-white">{t("kpi.stageTitle")}</h2>
            <p className="text-xs text-text-secondary dark:text-neutral-500 mt-0.5">
              {summary?.scope === "SELF" ? t("kpi.stageSubtitleSelf") : t("kpi.stageSubtitle")}
            </p>
          </div>
          {loading ? (
            <div className="flex flex-col gap-3">
              {[...Array(4)].map((_, i) => <Skeleton key={i} className="w-full h-8" />)}
            </div>
          ) : !summary?.stages.length ? (
            <p className="text-sm text-text-secondary dark:text-neutral-500 py-6 text-center">{t("kpi.noData")}</p>
          ) : (
            <BarChart
              rows={summary.stages.map((st) => ({
                key: st.stage,
                label: ts.has(st.stage) ? ts(st.stage) : st.stage,
                value: st.averageMs,
                hint: t("kpi.stageHint", { count: st.count }),
              }))}
              emphasis={summary.bottleneckStage}
              emphasisLabel={t("kpi.bottleneck")}
              format={formatDuration}
            />
          )}
        </div>

        <div className="rounded-2xl border border-border dark:border-neutral-800 bg-white dark:bg-neutral-900 p-5 shadow-card flex flex-col gap-4">
          <div>
            <h2 className="text-sm font-bold text-black dark:text-white">{t("kpi.ttmTitle")}</h2>
            <p className="text-xs text-text-secondary dark:text-neutral-500 mt-0.5">{t("kpi.ttmSubtitle")}</p>
          </div>
          {loading ? (
            <div className="flex flex-col gap-3">
              {[...Array(4)].map((_, i) => <Skeleton key={i} className="w-full h-8" />)}
            </div>
          ) : !summary?.ttmByOffer.length ? (
            <p className="text-sm text-text-secondary dark:text-neutral-500 py-6 text-center">
              {summary?.scope === "SELF" ? t("kpi.ttmTeamOnly") : t("kpi.noPublication")}
            </p>
          ) : (
            <>
              <div className="flex items-baseline gap-6 pb-1">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-text-secondary dark:text-neutral-500">{t("kpi.median")}</p>
                  <p className="text-2xl font-bold text-black dark:text-white tabular-nums">{formatDuration(summary.ttmMedianMs)}</p>
                </div>
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-text-secondary dark:text-neutral-500">{t("kpi.average")}</p>
                  <p className="text-2xl font-bold text-black dark:text-white tabular-nums">{formatDuration(summary.ttmAverageMs)}</p>
                </div>
              </div>
              <BarChart
                rows={summary.ttmByOffer.slice(0, 8).map((o) => ({
                  key: o.offerId,
                  label: offerNames[o.offerId] ?? o.offerId.slice(0, 8),
                  value: o.durationMs,
                }))}
                format={formatDuration}
              />
              {summary.ttmByOffer.length > 8 && (
                /* On annonce ce qui n'est pas montre : un graphique tronque en
                   silence se lit comme un graphique complet. */
                <p className="text-[11px] text-text-secondary dark:text-neutral-500">
                  {t("kpi.truncated", { shown: 8, total: summary.ttmByOffer.length })}
                </p>
              )}
            </>
          )}
        </div>
      </div>

      {/* ===== FILTRES ===== */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-neutral-400" viewBox="0 0 16 16" fill="none">
            <circle cx="7" cy="7" r="5" stroke="currentColor" strokeWidth="1.3" />
            <path d="M11 11l3.5 3.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
          </svg>
          <input value={search} onChange={(e) => setSearch(e.target.value)} onKeyDown={searchKeyHandler(setSearch)} placeholder={t("columns.offerId") + ", " + t("columns.actorId") + "..."} className="input w-full h-10 pl-9" />
        </div>
        <div className="relative">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-neutral-400 pointer-events-none" viewBox="0 0 16 16" fill="none">
            <path d="M2 4h12M4 8h8M6 12h4" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
          </svg>
          <select value={filterType} onChange={(e) => setFilterType(e.target.value)} className="input h-10 min-w-[160px] pl-9 appearance-none cursor-pointer">
            <option value="">{t("allTypes")}</option>
            {allTypes.map((ty) => (
              <option key={ty} value={ty}>{eventLabel(ty, t, t.has)}</option>
            ))}
          </select>
          <svg className="absolute right-3 top-1/2 -translate-y-1/2 size-3.5 text-neutral-400 pointer-events-none" viewBox="0 0 12 12" fill="none"><path d="M3 4.5l3 3 3-3" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" /></svg>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium text-text-secondary dark:text-neutral-500">{t("dateFrom")}</span>
          <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="input h-10" />
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium text-text-secondary dark:text-neutral-500">{t("dateTo")}</span>
          <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="input h-10" />
        </div>
      </div>

      {/* ===== TABLEAU ===== */}
      <div className="rounded-2xl border border-border dark:border-neutral-800 bg-white dark:bg-neutral-900 shadow-card overflow-hidden">
        <div className="hidden md:grid grid-cols-[1fr_120px_1fr_1fr_100px_160px] gap-3 px-6 py-3 bg-blue-600 dark:bg-blue-700 rounded-t-2xl">
          {[t("columns.event"), t("columns.type"), t("columns.offerId"), t("columns.actorId"), t("columns.duration"), t("columns.date")].map((col, i) => (
            <span key={i} className="text-[11px] font-semibold uppercase tracking-wider text-white">{col}</span>
          ))}
        </div>

        {loading ? (
          <div className="px-6 py-4 flex flex-col gap-1">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="hidden md:grid grid-cols-[1fr_120px_1fr_1fr_100px_160px] gap-3 items-center py-3.5">
                <div className="flex items-center gap-3">
                  <Skeleton className="size-9 !rounded-xl" />
                  <Skeleton className="w-20 h-4" />
                </div>
                <Skeleton className="w-20 h-5 !rounded-md" />
                <Skeleton className="w-24 h-4" />
                <Skeleton className="w-20 h-4" />
                <Skeleton className="w-16 h-4" />
                <Skeleton className="w-28 h-4" />
              </div>
            ))}
          </div>
        ) : paginated.length === 0 ? (
          <div className="px-6 py-16 text-center">
            <div className="flex flex-col items-center gap-5">
              <svg className="size-28" viewBox="0 0 120 120" fill="none">
                <rect x="20" y="20" width="80" height="80" rx="8" className="fill-blue-50 dark:fill-blue-900/15 stroke-blue-200 dark:stroke-blue-800/30" strokeWidth="1.5" />
                <path d="M40 80V55M55 80V40M70 80V50M85 80V35" className="stroke-blue-300 dark:stroke-blue-700/50" strokeWidth="4" strokeLinecap="round" />
                <circle cx="95" cy="30" r="2.5" className="fill-primary/20" />
                <circle cx="25" cy="90" r="2" className="fill-emerald-400/25" />
              </svg>
              <div>
                <p className="text-base font-bold text-black dark:text-white">{t("empty")}</p>
                <p className="text-sm text-text-secondary dark:text-neutral-500 mt-2 max-w-md mx-auto leading-relaxed">{t("emptyDescription")}</p>
              </div>
            </div>
          </div>
        ) : (
          <div className="divide-y divide-border dark:divide-neutral-800">
            {paginated.map((ev) => {
              const evType = ev.eventType?.toUpperCase() || "";
              const style = TYPE_STYLES[evType] ?? DEFAULT_STYLE;
              return (
                <div key={ev.id} className="grid grid-cols-1 md:grid-cols-[1fr_120px_1fr_1fr_100px_160px] gap-2 md:gap-3 items-center px-6 py-3.5 hover:bg-neutral-50 dark:hover:bg-neutral-800/30 transition-colors">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className={`size-9 rounded-xl flex items-center justify-center shrink-0 ${style.icon}`}>
                      {TYPE_ICONS[evType] ?? TRANSITION_ICON}
                    </div>
                    <span className="text-sm font-semibold text-black dark:text-white truncate">{eventLabel(evType, t, t.has)}</span>
                  </div>
                  <span className={`inline-flex items-center w-fit px-2.5 py-0.5 text-[11px] font-semibold rounded-md ${style.badge}`}>
                    {eventLabel(evType, t, t.has)}
                  </span>
                  <span className="text-xs text-text-secondary dark:text-neutral-400 font-mono truncate">{ev.offerId.slice(0, 12)}...</span>
                  <span className="text-xs text-text-secondary dark:text-neutral-400 font-mono truncate">{ev.actorId.slice(0, 12)}...</span>
                  <span className="text-xs font-medium text-black dark:text-white tabular-nums">{formatDuration(ev.durationMs)}</span>
                  <span className="text-xs text-text-secondary dark:text-neutral-400">{formatDate(ev.createdAt)}</span>
                </div>
              );
            })}
          </div>
        )}

        {/* Pagination */}
        {filtered.length > PER_PAGE && (
          <div className="flex items-center justify-between px-6 py-3 border-t border-border dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-800/20">
            <span className="text-xs text-text-secondary dark:text-neutral-500">
              {t("pagination.showing", { from: (page - 1) * PER_PAGE + 1, to: Math.min(page * PER_PAGE, filtered.length), total: filtered.length })}
            </span>
            <div className="flex items-center gap-1">
              <button onClick={() => setPage(Math.max(1, page - 1))} disabled={page === 1} className="size-8 rounded-lg flex items-center justify-center border border-border dark:border-neutral-700 hover:bg-neutral-100 dark:hover:bg-neutral-700 transition-colors disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer">
                <svg className="size-3.5 text-neutral-600 dark:text-neutral-300" viewBox="0 0 12 12" fill="none"><path d="M7.5 2.5L4 6l3.5 3.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" /></svg>
              </button>
              {Array.from({ length: Math.min(totalPages, 7) }, (_, i) => {
                let p: number;
                if (totalPages <= 7) { p = i + 1; }
                else if (page <= 4) { p = i + 1; }
                else if (page >= totalPages - 3) { p = totalPages - 6 + i; }
                else { p = page - 3 + i; }
                return (
                  <button key={p} onClick={() => setPage(p)} className={`size-8 rounded-lg flex items-center justify-center text-xs font-medium transition-colors cursor-pointer ${page === p ? "bg-primary text-white" : "border border-border dark:border-neutral-700 text-neutral-600 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-700"}`}>{p}</button>
                );
              })}
              <button onClick={() => setPage(Math.min(totalPages, page + 1))} disabled={page === totalPages} className="size-8 rounded-lg flex items-center justify-center border border-border dark:border-neutral-700 hover:bg-neutral-100 dark:hover:bg-neutral-700 transition-colors disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer">
                <svg className="size-3.5 text-neutral-600 dark:text-neutral-300" viewBox="0 0 12 12" fill="none"><path d="M4.5 2.5L8 6l-3.5 3.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" /></svg>
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ===== RAPPROCHEMENT AVEC LES SYSTÈMES TIERS =====
          Responsabilité du chef de département (cahier des charges l. 106). Elle
          n'avait aucune contrepartie dans l'interface : l'unique vue des exports
          était l'écran d'administration, fermé par EXPORT_MANAGE, permission que
          son rôle ne détient pas. Plutôt que de lui ouvrir cet écran — qui porte
          aussi le déclenchement manuel et l'export du catalogue, réservés à
          l'administration — le rapprochement est présenté ici, en lecture seule.
      */}
      {canSeeTeamScope && (
        <div className="rounded-2xl border border-border dark:border-neutral-800 bg-white dark:bg-neutral-900 shadow-card overflow-hidden">
          <div className="px-6 py-4 border-b border-border dark:border-neutral-800">
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <h2 className="text-sm font-bold text-black dark:text-white uppercase tracking-wider">
                {t("reconciliation.title")}
              </h2>
              {diffusionGaps.length > 0 && (
                <span className="px-2 py-1 rounded-lg text-[11px] font-semibold bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
                  {t("reconciliation.gapsCount", { count: diffusionGaps.length, total: reconciliation.length })}
                </span>
              )}
            </div>
            <p className="text-xs text-text-secondary dark:text-neutral-500 mt-1">
              {t("reconciliation.subtitle")}
            </p>
          </div>

          {reconciliation.length === 0 ? (
            <p className="px-6 py-6 text-sm text-text-secondary dark:text-neutral-500">
              {t("reconciliation.empty")}
            </p>
          ) : diffusionGaps.length === 0 ? (
            <p className="px-6 py-6 text-sm text-emerald-700 dark:text-emerald-400">
              {t("reconciliation.complete")}
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-800/30">
                    <th className="px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wider text-text-secondary dark:text-neutral-500">
                      {t("reconciliation.offer")}
                    </th>
                    {TARGET_SYSTEMS.map((system) => (
                      <th key={system} className="px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wider text-text-secondary dark:text-neutral-500">
                        {t(`reconciliation.systems.${system}`)}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-border dark:divide-neutral-800">
                  {/* Seules les offres incomplètes sont listées : celles qui sont
                      correctement diffusées n'appellent aucune action. */}
                  {diffusionGaps.map((row) => (
                    <tr key={row.id} className="hover:bg-neutral-50 dark:hover:bg-neutral-800/30 transition-colors">
                      <td className="px-4 py-3 font-medium text-black dark:text-white">{row.name}</td>
                      {row.targets.map((target) => (
                        <td key={target.system} className="px-4 py-3">
                          {/* Le statut est libellé, pas seulement coloré (NF5). */}
                          <span className={`inline-flex items-center px-2 py-0.5 text-[11px] font-semibold rounded-md ${DIFFUSION_STATUS_STYLES[target.status] ?? DIFFUSION_STATUS_STYLES.ABSENT}`}>
                            {t(`reconciliation.status.${target.status}`)}
                          </span>
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
