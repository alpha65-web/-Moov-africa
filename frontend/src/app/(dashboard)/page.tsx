"use client";

import { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import { useAuth } from "@/lib/auth";
import { usePermissions, queueStatusesFor } from "@/lib/permissions";
import api, { apiError } from "@/lib/api";
import toast from "react-hot-toast";
import type { Offer } from "@/lib/types";
import { useTranslations } from "next-intl";
import { accentBar } from "@/lib/accent";

/**
 * Carte de synthese du tableau de bord.
 *
 * `trend` est facultative : seules les cartes adossees a une serie datee — les
 * offres creees, les offres publiees — peuvent etre comparees aux trente jours
 * precedents. Sans ce type explicite, TypeScript infere l'union des litteraux du
 * tableau et `card.trend` n'existe plus sur les branches qui l'omettent, ce qui
 * faisait echouer `next build` alors que `next dev` laissait passer.
 */
interface StatCard {
  label: string;
  href: string;
  value: number;
  accent: string;
  icon: React.ReactNode;
  trend?: number | null;
}

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

/** Les dix statuts, dans l'ordre du cycle de vie decrit par le cahier des charges. */
const WORKFLOW_STATUSES = [
  "DRAFT", "IN_ENRICHMENT", "IN_VALIDATION", "VALIDATED", "PLANNED",
  "PUBLISHED", "SUSPENDED", "OBSOLETE", "WITHDRAWN", "ARCHIVED",
] as const;

/**
 * Une teinte par statut, pour les dix etapes du circuit.
 *
 * La couleur ne porte pas seule l'identite : chaque ligne est libellee et
 * chiffree. Elle sert de reperage, ce qui evite d'avoir a rendre dix teintes
 * mutuellement distinguables en vision daltonienne — ce qu'aucune palette
 * categorielle de cette taille ne permet.
 */
const STATUS_COLORS: Record<string, string> = {
  DRAFT: "#94a3b8",
  IN_ENRICHMENT: "#3b82f6",
  IN_VALIDATION: "#eab308",
  VALIDATED: "#14b8a6",
  PLANNED: "#a855f7",
  PUBLISHED: "#22c55e",
  SUSPENDED: "#f97316",
  OBSOLETE: "#ef4444",
  WITHDRAWN: "#e11d48",
  ARCHIVED: "#64748b",
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

/**
 * Anneau de repartition, avec le total inscrit en son centre.
 *
 * L'anneau d'origine ne portait que quatre des dix statuts du cycle de vie —
 * PUBLIEE, BROUILLON, EN ENRICHISSEMENT, EN VALIDATION — tout en affichant en son
 * centre le total *general* des offres. Les arcs et le chiffre central ne
 * pouvaient donc pas concorder : les fiches validees, planifiees, suspendues,
 * obsoletes, retirees et archivees etaient comptees au centre sans apparaitre sur
 * aucun arc.
 *
 * Il porte desormais tous les statuts non vides, dans l'ordre du circuit, et le
 * total central est la somme des arcs — l'egalite est garantie par construction
 * puisque les deux viennent du meme tableau.
 *
 * L'arc est trace avec strokeDasharray plutot qu'avec des chemins calcules :
 * la circonference sert d'unite, chaque part occupe sa fraction, et le decalage
 * cumule place le depart de la suivante. C'est aussi ce qui rend l'animation
 * d'apparition possible sans recalcul de geometrie.
 */
function DonutChart({
  segments,
  total,
  totalLabel,
}: {
  segments: { status: string; label: string; value: number; color: string }[];
  total: number;
  totalLabel: string;
}) {
  const size = 176;
  const strokeWidth = 26;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;

  let offset = 0;
  const arcs = segments.map((segment) => {
    const fraction = total > 0 ? segment.value / total : 0;
    const arc = {
      ...segment,
      dashArray: `${fraction * circumference} ${circumference}`,
      dashOffset: -offset * circumference,
    };
    offset += fraction;
    return arc;
  });

  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90" role="presentation">
        {/* Piste de fond : garde l'anneau lisible quand il n'y a aucune offre. */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          strokeWidth={strokeWidth}
          stroke="currentColor"
          className="text-neutral-100 dark:text-neutral-800"
        />
        {arcs.map((arc) => (
          <circle
            key={arc.status}
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            strokeWidth={strokeWidth}
            stroke={arc.color}
            strokeDasharray={arc.dashArray}
            strokeDashoffset={arc.dashOffset}
            className="transition-all duration-1000 ease-out"
          />
        ))}
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-[10px] font-medium uppercase tracking-wider text-text-secondary dark:text-neutral-500">
          {totalLabel}
        </span>
        <span className="text-2xl font-bold text-black dark:text-white tabular-nums leading-none mt-0.5">
          {total}
        </span>
      </div>
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
  // Ce que ce compte a personnellement a traiter : le tableau de bord
  // n'affichait que des totaux du catalogue, identiques pour tous les roles,
  // sans jamais indiquer a l'utilisateur ce qui attendait son intervention.
  const { has, hasAny } = usePermissions();

  /**
   * Metier de la personne connectee, deduit de ses permissions.
   *
   * Le tableau de bord etait le meme pour les six roles : memes cartes, meme
   * repartition sur les dix statuts du circuit, meme astuce sur les brouillons.
   * Un community manager, dont le cahier des charges borne le role a la
   * consultation des offres publiees et a la diffusion, y voyait le detail des
   * brouillons et des validations en cours, et une carte « Produits » qui
   * renvoyait vers un ecran que son menu ne lui propose meme pas.
   */
  const isDiffusion = has("CAMPAIGN_MANAGE") && !hasAny(
    "OFFER_CREATE", "OFFER_SUBMIT", "OFFER_ENRICH", "OFFER_VALIDATE", "OFFER_PUBLISH");
  const canCreateOffers = has("OFFER_CREATE");
  const canEnrich = has("OFFER_ENRICH");
  const canValidate = has("OFFER_VALIDATE");
  const canPublish = has("OFFER_PUBLISH");
  const canValidateMedia = has("MEDIA_VALIDATE");
  // Le catalogue n'est un repere que pour ceux qui interviennent sur une fiche.
  const showsCatalog = hasAny("CATALOG_MANAGE", "OFFER_ENRICH", "OFFER_VALIDATE", "OFFER_PUBLISH");

  const queueStatuses = queueStatusesFor(has);
  // Cle stable pour la dependance de l'effet : un tableau recree a chaque
  // rendu relancerait le chargement en boucle.
  const queueKey = queueStatuses.join(",");
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
  const [allOffers, setAllOffers] = useState<Offer[]>([]);
  // Effectif par statut, compte par la base et non dans le navigateur. Les
  // compteurs et l'anneau de repartition s'en servent : ils restent exacts quel
  // que soit le volume du catalogue, la ou un comptage sur la page chargee
  // devenait faux — sans le dire — au-dela de cinq cents fiches.
  const [statusCounts, setStatusCounts] = useState<Record<string, number>>({});
  const [recentOffers, setRecentOffers] = useState<Offer[]>([]);
  // Medias en attente de validation graphique : c'est la file du chef de service
  // sur le circuit dedie, distinct du circuit metier. Chargee seulement pour lui.
  const [pendingMedia, setPendingMedia] = useState(0);
  const [loading, setLoading] = useState(true);

  // Recalcule des que le profil arrive, sans relancer le chargement.
  const queueCount = useMemo(() => {
    const wanted = queueKey ? queueKey.split(",") : [];
    return wanted.reduce((sum, status) => sum + (statusCounts[status] ?? 0), 0);
  }, [statusCounts, queueKey]);

  useEffect(() => {
    async function load() {
      try {
        const [statsRes, offersRes, catalogRes, usersRes, campaignsRes] = await Promise.all([
          api.get("/offers/stats").catch(() => ({ data: null })),
          // Le tri est explicite : sans lui, la base renvoie les fiches dans
          // l'ordre qui l'arrange, et les « offres recentes » n'etaient recentes
          // que par hasard. Il rend aussi la coupure a cinq cents deterministe
          // pour les deux analyses ci-dessous, qui ont besoin des lignes elles-memes.
          api.get("/offers", { params: { size: 500, sort: "createdAt,desc" } }).catch(() => ({ data: [] })),
          api.get("/catalog", { params: { size: 1 } }).catch(() => ({ data: [] })),
          api.get("/users").catch(() => ({ data: [] })),
          api.get("/campaigns/mine").catch(() => ({ data: [] })),
        ]);

        // /offers et /catalog renvoient des Page<> ; /users et /campaigns/mine des tableaux nus.
        const offers: Offer[] = offersRes.data.content ?? offersRes.data;
        // Le catalogue n'est plus telecharge pour etre compte : la page en porte
        // deja l'effectif total.
        const catalogTotal: number = catalogRes.data?.totalElements
          ?? (catalogRes.data?.content ?? catalogRes.data ?? []).length;
        const counts: Record<string, number> = statsRes.data?.byStatus ?? {};
        const countOf = (status: string) => counts[status] ?? 0;

        setStatusCounts(counts);
        setStats({
          totalOffers: statsRes.data?.total ?? offers.length,
          publishedOffers: countOf("PUBLISHED"),
          draftOffers: countOf("DRAFT"),
          catalogItems: catalogTotal,
          totalUsers: usersRes.data.length,
          activeCampaigns: campaignsRes.data.filter((c: { status: string }) => c.status === "PUBLISHED" || c.status === "SCHEDULED").length,
          inEnrichment: countOf("IN_ENRICHMENT"),
          inValidation: countOf("IN_VALIDATION"),
        });
        setAllOffers(offers);
        setRecentOffers(offers.slice(0, 5));
      } catch (e) {
        toast.error(apiError(e, tc("errors.load")));
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  // La file de validation graphique ne concerne que le chef de service : la
  // requete n'est meme pas emise pour les autres roles.
  useEffect(() => {
    if (!canValidateMedia) return;
    let cancelled = false;
    api.get("/media")
      .then(({ data }) => {
        if (cancelled) return;
        const items = Array.isArray(data) ? data : data.content ?? [];
        setPendingMedia(items.filter(
          (m: { conformityStatus: string }) => m.conformityStatus === "PENDING").length);
      })
      .catch(() => { if (!cancelled) setPendingMedia(0); });
    return () => { cancelled = true; };
  }, [canValidateMedia]);

  const hour = new Date().getHours();
  const greeting =
    hour < 12 ? t("greeting_morning") : hour < 18 ? t("greeting_afternoon") : t("greeting_evening");

  /**
   * Repartition des offres par etape du circuit.
   *
   * L'anneau precedent n'affichait que quatre statuts sur les dix du cycle de
   * vie, tout en inscrivant le total general en son centre : sur les treize
   * offres reelles, les arcs n'en couvraient que dix et trois fiches — validee,
   * suspendue, archivee — n'apparaissaient nulle part. Le chiffre central et la
   * somme des parts ne concordaient donc jamais.
   *
   * La repartition porte desormais sur les dix statuts, dans l'ordre du circuit :
   * la somme des lignes est le total, par construction. L'ordre est celui du
   * workflow et non celui des effectifs, parce que ces statuts forment une suite
   * et que leur progression est l'information utile.
   */
  const pipeline = useMemo(() => {
    return WORKFLOW_STATUSES
      .map((status) => ({
        status,
        label: ts.has(status) ? ts(status) : status,
        value: statusCounts[status] ?? 0,
      }))
      .filter((row) => row.value > 0);
  }, [statusCounts, ts]);

  /**
   * Somme des parts effectivement dessinees.
   *
   * C'est ce total qui s'inscrit au centre de l'anneau, et non stats.totalOffers.
   * Les deux coincident tant que la repartition couvre tous les statuts — ce qui
   * est le cas — mais faire porter le centre par la somme des arcs rend l'egalite
   * vraie par construction plutot que par coincidence. C'est exactement ce qui
   * manquait a l'anneau d'origine, dont le centre comptait des fiches qui
   * n'apparaissaient sur aucun arc.
   */
  const pipelineTotal = pipeline.reduce((sum, row) => sum + row.value, 0);

  /**
   * Evolution sur trente jours, comparee aux trente precedents.
   *
   * Calculee sur les dates reellement enregistrees, jamais estimee. Renvoie null
   * lorsque la periode precedente ne contient rien : une progression rapportee a
   * zero n'a pas de sens, et afficher « +0 % » ou « +100 % » dans ce cas serait un
   * chiffre invente. La carte n'affiche alors simplement pas de tendance — c'est
   * le cas aujourd'hui, la base ne portant que deux offres.
   */
  function trendOver30Days(dates: (string | null | undefined)[]): number | null {
    const now = Date.now();
    const day = 24 * 60 * 60 * 1000;
    let current = 0;
    let previous = 0;

    for (const date of dates) {
      if (!date) continue;
      const age = now - new Date(date).getTime();
      if (age < 0) continue;
      if (age <= 30 * day) current += 1;
      else if (age <= 60 * day) previous += 1;
    }

    if (previous === 0) return null;
    return Math.round(((current - previous) / previous) * 100);
  }

  const offersTrend = useMemo(
    () => trendOver30Days(allOffers.map((o) => o.createdAt)),
    [allOffers]);
  const publishedTrend = useMemo(
    () => trendOver30Days(allOffers.filter((o) => o.status === "PUBLISHED").map((o) => o.publishDate)),
    [allOffers]);

  /**
   * Fiches les moins completes, du score le plus bas au plus haut.
   *
   * Le score de completude etait affiche sur chaque ligne de l'ecran des offres
   * mais nulle part en synthese : rien n'indiquait par ou commencer. Cette carte
   * repond a « quelle fiche dois-je completer en premier ». Les fiches deja
   * publiees en sont exclues : leur completude n'appelle plus d'action.
   *
   * Contrairement aux compteurs, ce classement porte sur les cinq cents fiches
   * les plus recentes et non sur tout le catalogue : il lui faut les lignes
   * elles-memes, que le comptage par statut ne transporte pas. La distinction
   * reste sans effet tant que le catalogue tient sous cette limite.
   */
  const leastComplete = useMemo(
    () => allOffers
      .filter((o) => !["PUBLISHED", "ARCHIVED", "WITHDRAWN", "OBSOLETE"].includes(o.status))
      .sort((a, b) => a.qualityScore - b.qualityScore)
      .slice(0, 4),
    [allOffers]);

  const canManageUsers = has("USER_MANAGE");

  const countByStatus = (...statuses: string[]) =>
    allOffers.filter((o) => statuses.includes(o.status)).length;

  const roleCards = [
    // Chaque role ouvre sur le chiffre de SON etape, pas sur le total general.
    ...(canCreateOffers ? [{
      label: t("cards.myDrafts"), href: "/offers?status=DRAFT", value: stats.draftOffers,
      accent: "text-neutral-600 dark:text-neutral-300 bg-neutral-500/10",
      icon: (<svg className="size-5" viewBox="0 0 20 20" fill="none"><rect x="3" y="2" width="14" height="16" rx="2" stroke="currentColor" strokeWidth="1.5" /><path d="M7 7h6M7 10.5h4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" /></svg>),
    }] : []),
    ...(canEnrich ? [{
      label: t("cards.toEnrich"), href: "/offers?status=IN_ENRICHMENT", value: stats.inEnrichment,
      accent: "text-blue-600 dark:text-blue-400 bg-blue-500/10",
      icon: (<svg className="size-5" viewBox="0 0 20 20" fill="none"><path d="M10 2v4M10 14v4M2 10h4M14 10h4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" /><circle cx="10" cy="10" r="3" stroke="currentColor" strokeWidth="1.5" /></svg>),
    }] : []),
    ...(canValidate ? [{
      label: t("cards.toValidate"), href: "/offers?status=IN_VALIDATION", value: stats.inValidation,
      accent: "text-amber-600 dark:text-amber-400 bg-amber-500/10",
      icon: (<svg className="size-5" viewBox="0 0 20 20" fill="none"><path d="M10 2l1.5 3 3.5.5-2.5 2.4.6 3.1L10 9.5 6.9 11l.6-3.1L5 5.5l3.5-.5L10 2z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" /></svg>),
    }] : []),
    ...(canValidateMedia ? [{
      label: t("cards.mediaToValidate"), href: "/media", value: pendingMedia,
      accent: "text-purple-600 dark:text-purple-400 bg-purple-500/10",
      icon: (<svg className="size-5" viewBox="0 0 20 20" fill="none"><rect x="2" y="3" width="16" height="14" rx="2" stroke="currentColor" strokeWidth="1.5" /><circle cx="7" cy="8" r="2" stroke="currentColor" strokeWidth="1.5" /><path d="M2 14l4-4 3 3 4-5 5 6" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" /></svg>),
    }] : []),
    ...(canPublish ? [{
      label: t("cards.toPublish"), href: "/offers?status=VALIDATED", value: countByStatus("VALIDATED", "PLANNED"),
      accent: "text-teal-600 dark:text-teal-400 bg-teal-500/10",
      icon: (<svg className="size-5" viewBox="0 0 20 20" fill="none"><path d="M10 15V5M6 9l4-4 4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /><path d="M4 17h12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" /></svg>),
    }] : []),
    ...(isDiffusion ? [{
      label: t("cards.campaignsActive"), href: "/campaigns", value: stats.activeCampaigns,
      accent: "text-primary bg-primary/10",
      icon: (<svg className="size-5" viewBox="0 0 20 20" fill="none"><path d="M3 10l4-6v12l-4-6zM7 5l9-2v14l-9-2V5z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" /></svg>),
    }] : []),
  ];

  const statCards: StatCard[] = [
    // En tete, et seulement pour les roles qui interviennent dans le circuit :
    // ce chiffre est le seul de cet ecran qui parle du travail de la personne
    // connectee plutot que de l'etat general du catalogue.
    ...(queueStatuses.length > 0 ? [{
      label: t("toProcess"),
      href: "/offers",
      value: queueCount,
      accent: "text-primary bg-primary/10",
      icon: (
        <svg className="size-5" viewBox="0 0 20 20" fill="none">
          <path d="M3 5h14M3 10h14M3 15h9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
      ),
    }] : []),
    ...roleCards,
    // Le total general n'a de sens que pour qui embrasse tout le circuit : pour
    // les autres, il melange leurs fiches a celles des etapes qui ne les
    // concernent pas. Le community manager, lui, ne compte que le publie.
    ...(!isDiffusion ? [{
      label: t("totalOffers"),
      href: "/offers",
      value: stats.totalOffers,
      trend: offersTrend,
      accent: "text-primary bg-primary/10",
      icon: (
        <svg className="size-5" viewBox="0 0 20 20" fill="none">
          <path d="M10 2l2.5 5 5.5.8-4 3.9.9 5.3L10 14.5 5.1 17l.9-5.3-4-3.9 5.5-.8L10 2z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
        </svg>
      ),
    }] : []),
    {
      label: t("published"),
      trend: publishedTrend,
      href: "/offers?status=PUBLISHED",
      value: stats.publishedOffers,
      accent: "text-emerald-600 dark:text-emerald-400 bg-emerald-500/10",
      icon: (
        <svg className="size-5" viewBox="0 0 20 20" fill="none">
          <circle cx="10" cy="10" r="7" stroke="currentColor" strokeWidth="1.5" />
          <path d="M7 10l2 2 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      ),
    },
    // Cette carte menait vers /catalog, ecran que le menu du community manager
    // ne contient pas : elle le conduisait donc hors de son perimetre.
    ...(showsCatalog ? [{
      label: t("products"),
      href: "/catalog",
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
    }] : []),
    ...(canManageUsers ? [{
      label: t("users"),
      href: "/users",
      value: stats.totalUsers,
      accent: "text-purple-600 dark:text-purple-400 bg-purple-500/10",
      icon: (
        <svg className="size-5" viewBox="0 0 20 20" fill="none">
          <circle cx="10" cy="7" r="4" stroke="currentColor" strokeWidth="1.5" />
          <path d="M3 18c0-3.3 3.1-6 7-6s7 2.7 7 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
      ),
    }] : []),
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
          {greeting}, {user?.firstName}
        </h1>
        <p className="text-sm text-text-secondary dark:text-neutral-500 mt-1">
          {t("subtitle")}
        </p>
      </div>

      {/* ===== 4 STAT CARDS ===== */}
      {/* Le nombre de cartes varie de 4 à 6 selon le rôle : items-stretch garde la
          rangée d'aplomb quand un libellé passe sur deux lignes, et xl:grid-cols-3
          évite qu'une sixième carte se retrouve seule sur une deuxième rangée. */}
      <div className={`grid grid-cols-2 gap-4 items-stretch ${
        statCards.length > 4 ? "lg:grid-cols-3"
          : statCards.length === 3 ? "lg:grid-cols-3"
          : statCards.length <= 2 ? "lg:grid-cols-2"
          : "lg:grid-cols-4"}`}>
        {statCards.map((card, i) => (
          <Link
            key={card.label}
            href={card.href}
            className="relative overflow-hidden h-full block rounded-2xl border border-border dark:border-neutral-800 bg-white dark:bg-neutral-900 p-5 pl-6 shadow-card transition-all duration-200 hover:shadow-lg hover:-translate-y-0.5 group animate-fade-in"
            style={{ animationDelay: `${i * 80}ms`, animationFillMode: "backwards" }}
          >
            <span className={`absolute top-0 bottom-0 left-0 w-1 ${accentBar(card.accent)}`} aria-hidden="true" />
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
                {/* Tendance sur trente jours. Absente quand la période précédente
                    est vide : une progression rapportée à zéro n'a pas de sens, et
                    un « +0 % » de remplissage serait un chiffre inventé. */}
                {!loading && card.trend != null && (
                  <p className={`mt-2 flex items-center gap-1 text-[11px] font-semibold ${
                    card.trend >= 0
                      ? "text-emerald-600 dark:text-emerald-400"
                      : "text-red-600 dark:text-red-400"
                  }`}>
                    <svg className="size-3" viewBox="0 0 12 12" fill="none" aria-hidden="true">
                      <path
                        d={card.trend >= 0 ? "M6 9.5V2.5M3 5.5L6 2.5l3 3" : "M6 2.5v7M3 6.5l3 3 3-3"}
                        stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"
                      />
                    </svg>
                    <span className="tabular-nums">{card.trend >= 0 ? "+" : ""}{card.trend} %</span>
                    <span className="font-normal text-text-secondary dark:text-neutral-500">
                      {t("vsPrevious")}
                    </span>
                  </p>
                )}
              </div>
              <div className={`rounded-xl p-2.5 ${card.accent} transition-transform duration-200 group-hover:scale-110`}>
                {card.icon}
              </div>
            </div>
          </Link>
        ))}
      </div>

      {/* ===== RÉPARTITION + OFFRES RÉCENTES ===== */}
      {/* La repartition sur les dix statuts du circuit ne s'affiche que pour ceux
          qui y prennent part. Le community manager n'a pas a suivre les
          brouillons et les validations des autres : la liste passe alors en
          pleine largeur plutot que de laisser une colonne vide. */}
      <div className={`${isDiffusion ? "grid grid-cols-1" : "grid grid-cols-1 lg:grid-cols-2"} gap-4 items-stretch`}>

        {!isDiffusion && (
        /* h-full + flex : sans cela, la carte de répartition s'arrêtait à la
           hauteur de son contenu — deux lignes de légende aujourd'hui — et
           laissait un vide sous elle en regard de la liste des offres récentes,
           bien plus haute. Les deux colonnes s'alignent désormais, et l'anneau
           se centre dans l'espace disponible au lieu de rester collé en haut. */
        <div className="h-full flex flex-col rounded-2xl border border-border dark:border-neutral-800 bg-white dark:bg-neutral-900 p-6 shadow-card animate-fade-in" style={{ animationDelay: "250ms", animationFillMode: "backwards" }}>
          <h2 className="text-sm font-bold text-black dark:text-white uppercase tracking-wider mb-6 shrink-0">
            {t("offerBreakdown")}
          </h2>
          {loading ? (
            <div className="flex-1 flex items-center justify-center min-h-52">
              <div className="size-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
            </div>
          ) : pipeline.length === 0 ? (
            <div className="flex-1 flex items-center justify-center min-h-52">
              <p className="text-sm text-text-secondary dark:text-neutral-500">{t("noOffers")}</p>
            </div>
          ) : (
            <div className="flex-1 flex flex-col sm:flex-row items-center justify-center gap-6 sm:gap-8">
              <DonutChart
                segments={pipeline.map((row) => ({
                  status: row.status,
                  label: row.label,
                  value: row.value,
                  color: STATUS_COLORS[row.status] ?? STATUS_COLORS.DRAFT,
                }))}
                /* Somme des parts affichees, et non le total general : c'est
                   l'egalite qui manquait a l'anneau d'origine. */
                total={pipelineTotal}
                totalLabel={t("total")}
              />

              {/* Légende chiffrée. Chaque ligne mène à la liste filtrée sur ce
                  statut : les chiffres du tableau de bord étaient jusqu'ici
                  inertes. Le libellé et le nombre accompagnent toujours la
                  pastille de couleur — l'information n'est jamais portée par la
                  seule teinte, ce qu'aucune palette de dix couleurs ne
                  permettrait de toute façon. */}
              <ul className="w-full sm:flex-1 sm:w-auto flex flex-col gap-0.5">
                {pipeline.map((row) => {
                  const pct = pipelineTotal > 0 ? Math.round((row.value / pipelineTotal) * 100) : 0;
                  return (
                    <li key={row.status}>
                      <Link
                        href={`/offers?status=${row.status}`}
                        className="flex items-center gap-2.5 rounded-lg px-2 py-1.5 -mx-2 hover:bg-neutral-50 dark:hover:bg-neutral-800/40 transition-colors"
                      >
                        <span
                          className="shrink-0 size-2.5 rounded-full"
                          style={{ backgroundColor: STATUS_COLORS[row.status] ?? STATUS_COLORS.DRAFT }}
                          aria-hidden="true"
                        />
                        <span className="flex-1 min-w-0 text-xs font-medium text-black dark:text-neutral-300 truncate">
                          {row.label}
                        </span>
                        <span className="shrink-0 text-xs font-bold text-black dark:text-white tabular-nums">
                          {row.value}
                        </span>
                        <span className="shrink-0 w-9 text-right text-xs text-neutral-400 tabular-nums">
                          {pct}%
                        </span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          )}
        </div>
        )}

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

      {/* ===== COMPLÉTUDE DES FICHES + ASTUCE =====
          Troisième rangée, sur le modèle « Goals Progress + Smart Tip » de la
          maquette : une carte de progression sur deux tiers, l'astuce sur un
          tiers. L'astuce occupait auparavant toute la largeur, seule, ce qui
          laissait la rangée déséquilibrée.

          L'équivalent des objectifs, pour un référentiel produit, c'est la
          complétude des fiches : le score était calculé et affiché ligne par ligne
          sur l'écran des offres, mais nulle part en synthèse — rien n'indiquait
          par où commencer. */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 items-stretch">

        {!isDiffusion && (
        <div className="lg:col-span-2 h-full flex flex-col rounded-2xl border border-border dark:border-neutral-800 bg-white dark:bg-neutral-900 shadow-card overflow-hidden animate-fade-in" style={{ animationDelay: "450ms", animationFillMode: "backwards" }}>
          <div className="flex items-center justify-between px-6 py-4 border-b border-border dark:border-neutral-800 shrink-0">
            <h2 className="text-sm font-bold text-black dark:text-white uppercase tracking-wider">
              {t("completeness")}
            </h2>
            <Link href="/offers" className="text-xs font-medium text-primary hover:text-primary-light transition-colors">
              {t("viewAll")}
            </Link>
          </div>

          {loading ? (
            <div className="flex-1 flex items-center justify-center min-h-32">
              <div className="size-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
            </div>
          ) : leastComplete.length === 0 ? (
            <div className="flex-1 flex items-center justify-center min-h-32 px-6">
              <p className="text-sm text-text-secondary dark:text-neutral-500 text-center">
                {t("completenessEmpty")}
              </p>
            </div>
          ) : (
            <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 gap-3 p-4">
              {leastComplete.map((offer) => {
                const score = Math.round(offer.qualityScore);
                return (
                  <Link
                    key={offer.id}
                    href="/offers"
                    className="flex flex-col gap-2 rounded-xl border border-border dark:border-neutral-800 px-4 py-3 hover:bg-neutral-50 dark:hover:bg-neutral-800/40 transition-colors"
                  >
                    <div className="flex items-start gap-2.5 min-w-0">
                      <StatusIcon status={offer.status} />
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold text-black dark:text-white truncate">{offer.name}</p>
                        <p className="text-[11px] text-text-secondary dark:text-neutral-500 truncate">
                          {ts.has(offer.status) ? ts(offer.status) : offer.status}
                        </p>
                      </div>
                    </div>
                    {/* Barre de progression, comme les objectifs de la maquette.
                        Le pourcentage est inscrit : la couleur ne le porte pas seule. */}
                    <div className="flex items-center gap-2">
                      <div className="flex-1 h-1.5 rounded-full bg-neutral-100 dark:bg-neutral-800 overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all duration-1000 ease-out ${
                            score >= 80 ? "bg-emerald-500" : score >= 50 ? "bg-amber-500" : "bg-red-500"
                          }`}
                          style={{ width: `${Math.min(score, 100)}%` }}
                        />
                      </div>
                      <span className="shrink-0 text-[11px] font-bold text-black dark:text-white tabular-nums">
                        {score} %
                      </span>
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </div>
        )}

      <div className={`${isDiffusion ? "lg:col-span-3" : ""} h-full flex items-center rounded-2xl border border-primary/15 bg-primary/[0.03] dark:bg-primary/[0.06] px-6 py-4 animate-fade-in`} style={{ animationDelay: "500ms", animationFillMode: "backwards" }}>
        <div className="flex items-start gap-3">
          <div className="rounded-lg bg-primary/10 p-2 text-primary shrink-0">
            <svg className="size-4" viewBox="0 0 20 20" fill="none">
              <path d="M10 3a4 4 0 014 4c0 1.5-.8 2.5-1.5 3.2-.4.4-.5.6-.5 1.3V12H8v-.5c0-.7-.1-.9-.5-1.3C6.8 9.5 6 8.5 6 7a4 4 0 014-4z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M8 14.5h4M8.5 17h3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-bold text-primary">{t("smartTip")}</p>
            <span className="text-xs text-text-secondary dark:text-neutral-400 leading-relaxed">
              {isDiffusion
                ? t("tipDiffusion", { count: stats.publishedOffers })
                : queueCount > 0
                  ? t("tipQueue", { count: queueCount })
                  : canCreateOffers && stats.draftOffers > 0
                    ? t("tipDrafts", { count: stats.draftOffers })
                    : stats.totalOffers === 0
                      ? t("tipEmpty")
                      : t("tipGood")}
            </span>
          </div>
        </div>
      </div>
      </div>
    </div>
  );
}
