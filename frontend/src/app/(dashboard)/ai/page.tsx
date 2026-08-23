"use client";

import { useEffect, useState, useMemo, useRef, useCallback } from "react";
import Link from "next/link";
import api from "@/lib/api";
import type { Offer } from "@/lib/types";
import toast from "react-hot-toast";
import { useTranslations } from "next-intl";
import Reveal, { RevealGroup } from "@/components/Reveal";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell,
  LineChart, Line,
} from "recharts";

/* ══════════════════════════════════════════════════════
   Types
   ══════════════════════════════════════════════════════ */

type Tab = "generate" | "quality" | "pricing" | "anomalies" | "translate" | "usage";

interface GeneratedContent {
  shortDescription: string;
  longDescription: string;
  seoTitle: string;
  seoDescription: string;
  legalMentions: string;
  marketingSlogan: string;
}

interface QualityCriterion { name: string; score: number; maxScore: number; feedback: string }
interface QualityReport { overallScore: number; grade: string; criteria: QualityCriterion[]; suggestions: string[] }

interface PricePoint { label: string; price: number; description: string }
interface PricingSuggestion { suggestedPrice: number; minPrice: number; maxPrice: number; currency: string; rationale: string; pricePoints: PricePoint[] }

interface Anomaly { entityId: string; entityName: string; type: string; severity: string; description: string; recommendation: string }
interface AnomalyReport { totalChecked: number; anomalyCount: number; anomalies: Anomaly[] }

interface TranslationResult { sourceLanguage: string; targetLanguage: string; translatedName: string; translatedShortDescription: string; translatedLongDescription: string; translatedSeoTitle: string; translatedSeoDescription: string }

interface UsageStats { totalRequests: number; successfulRequests: number; failedRequests: number; totalInputTokens: number; totalOutputTokens: number; avgLatencyMs: number; requestsByTask: Record<string, number>; requestsByDay: Record<string, number> }

/* ══════════════════════════════════════════════════════
   Micro components
   ══════════════════════════════════════════════════════ */

function useCountUp(target: number, duration = 800) {
  const [value, setValue] = useState(0);
  const rafRef = useRef(0);
  useEffect(() => {
    if (target === 0) { setValue(0); return; }
    const start = performance.now();
    const step = (now: number) => {
      const progress = Math.min((now - start) / duration, 1);
      setValue(Math.round((1 - Math.pow(1 - progress, 3)) * target));
      if (progress < 1) rafRef.current = requestAnimationFrame(step);
    };
    rafRef.current = requestAnimationFrame(step);
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
  }, [target, duration]);
  return value;
}

function AnimatedNumber({ value, suffix = "" }: { value: number; suffix?: string }) {
  const animated = useCountUp(value);
  return <>{animated}{suffix}</>;
}

function Skeleton({ className = "" }: { className?: string }) {
  return <div className={`rounded-lg bg-neutral-100 dark:bg-white/[0.04] animate-pulse ${className}`} />;
}

function ProgressBar({ value, color, height = "h-[5px]" }: { value: number; color: string; height?: string }) {
  return (
    <div className={`${height} w-full rounded-full bg-neutral-100 dark:bg-white/[0.06] overflow-hidden`}>
      <div className={`h-full rounded-full transition-all duration-700 ease-out ${color}`} style={{ width: `${Math.min(100, Math.max(0, value))}%` }} />
    </div>
  );
}

function ScoreGauge({ score, grade, size = 140 }: { score: number; grade: string; size?: number }) {
  const radius = (size - 16) / 2;
  const circumference = 2 * Math.PI * radius;
  const progress = (score / 100) * circumference;
  const gradeColor = GRADE_HEX[grade] || "#94a3b8";

  return (
    <div className="relative inline-flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" strokeWidth={8}
          className="stroke-neutral-100 dark:stroke-white/[0.06]" />
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" strokeWidth={8}
          stroke={gradeColor} strokeLinecap="round"
          strokeDasharray={circumference} strokeDashoffset={circumference - progress}
          className="transition-all duration-1000 ease-out" />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-2xl font-bold text-neutral-900 dark:text-white tabular-nums">{score}</span>
        <span className="text-[10px] font-medium mt-0.5" style={{ color: gradeColor }}>Grade {grade}</span>
      </div>
    </div>
  );
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try { await navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 1500); } catch { /* */ }
  };
  return (
    <button onClick={copy} className="shrink-0 p-1 rounded hover:bg-neutral-100 dark:hover:bg-white/[0.06] transition-colors" title="Copier">
      {copied ? (
        <svg className="size-3.5 text-emerald-500" viewBox="0 0 20 20" fill="none"><path d="M5 10l3 3 7-7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
      ) : (
        <svg className="size-3.5 text-neutral-400" viewBox="0 0 20 20" fill="none"><rect x="6" y="6" width="10" height="10" rx="1.5" stroke="currentColor" strokeWidth="1.5" /><path d="M14 6V5a1.5 1.5 0 00-1.5-1.5H5A1.5 1.5 0 003.5 5v7.5A1.5 1.5 0 005 14h1" stroke="currentColor" strokeWidth="1.5" /></svg>
      )}
    </button>
  );
}

function EmptyState({ icon, message }: { icon: React.ReactNode; message: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-center">
      <div className="size-10 rounded-full bg-neutral-100 dark:bg-white/[0.04] flex items-center justify-center mb-3">
        {icon}
      </div>
      <p className="text-[13px] text-neutral-400 dark:text-neutral-500">{message}</p>
    </div>
  );
}

function ErrorBanner({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="flex items-center gap-3 p-4 rounded-xl bg-red-50 dark:bg-red-500/10 border border-red-200/50 dark:border-red-500/20">
      <svg className="size-5 text-red-500 shrink-0" viewBox="0 0 20 20" fill="none"><circle cx="10" cy="10" r="8" stroke="currentColor" strokeWidth="1.5" /><path d="M10 6v5M10 13.5v.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" /></svg>
      <p className="flex-1 text-[13px] text-red-600 dark:text-red-400">{message}</p>
      {onRetry && (
        <button onClick={onRetry} className="shrink-0 text-[12px] font-medium text-red-500 hover:text-red-600 transition-colors">
          Reessayer
        </button>
      )}
    </div>
  );
}

function ChartTooltip({ active, payload, label }: { active?: boolean; payload?: Array<{ value: number; name: string; color: string }>; label?: string }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="surface px-3 py-2.5 text-xs !shadow-xl">
      <p className="font-medium text-neutral-900 dark:text-white mb-1.5">{label}</p>
      {payload.map((p, i) => (
        <div key={i} className="flex items-center gap-2 py-0.5">
          <span className="size-[6px] rounded-full shrink-0" style={{ background: p.color }} />
          <span className="text-neutral-500 dark:text-neutral-400">{p.name}</span>
          <span className="font-semibold text-neutral-900 dark:text-white ml-auto tabular-nums">{p.value}</span>
        </div>
      ))}
    </div>
  );
}

/* ══════════════════════════════════════════════════════
   Constants
   ══════════════════════════════════════════════════════ */

const GRADE_HEX: Record<string, string> = { A: "#10b981", B: "#3b82f6", C: "#f59e0b", D: "#f97316", F: "#ef4444" };

const SEVERITY_CONFIG: Record<string, { bg: string; text: string; dot: string; hex: string }> = {
  CRITICAL: { bg: "bg-red-50 dark:bg-red-500/10", text: "text-red-600 dark:text-red-400", dot: "bg-red-500", hex: "#ef4444" },
  HIGH: { bg: "bg-orange-50 dark:bg-orange-500/10", text: "text-orange-600 dark:text-orange-400", dot: "bg-orange-500", hex: "#f97316" },
  MEDIUM: { bg: "bg-amber-50 dark:bg-amber-500/10", text: "text-amber-600 dark:text-amber-400", dot: "bg-amber-500", hex: "#f59e0b" },
  LOW: { bg: "bg-blue-50 dark:bg-blue-500/10", text: "text-blue-600 dark:text-blue-400", dot: "bg-blue-500", hex: "#3b82f6" },
};

const TASK_HEX: Record<string, string> = {
  GENERATE_DESCRIPTION: "#8b5cf6", GENERATE_SEO: "#3b82f6", GENERATE_LEGAL: "#14b8a6",
  QUALITY_SCORE: "#10b981", SUGGEST_PRICING: "#f59e0b", SUGGEST_SEGMENT: "#f97316",
  DETECT_ANOMALIES: "#ef4444", TRANSLATE: "#ec4899", SUMMARIZE_CATALOG: "#6366f1",
  COMPETITOR_ANALYSIS: "#0ea5e9",
};

const TONES = ["professionnel", "commercial", "jeune", "premium"] as const;
const LANGUAGES = [
  { code: "fr", label: "Francais" },
  { code: "en", label: "English" },
  { code: "ar", label: "العربية" },
] as const;
const TARGET_LANGUAGES = [
  { code: "en", label: "English" },
  { code: "ar", label: "العربية" },
  { code: "de", label: "Deutsch" },
  { code: "es", label: "Espanol" },
  { code: "pt", label: "Portugues" },
  { code: "sw", label: "Kiswahili" },
] as const;

const GENERATED_FIELDS: { key: keyof GeneratedContent; label: string }[] = [
  { key: "shortDescription", label: "Description courte" },
  { key: "longDescription", label: "Description longue" },
  { key: "seoTitle", label: "Titre SEO" },
  { key: "seoDescription", label: "Meta description" },
  { key: "legalMentions", label: "Mentions legales" },
  { key: "marketingSlogan", label: "Slogan marketing" },
];

const TRANSLATION_FIELDS: { key: keyof TranslationResult; label: string; sourceKey: keyof Offer }[] = [
  { key: "translatedName", label: "Nom", sourceKey: "name" },
  { key: "translatedShortDescription", label: "Description courte", sourceKey: "shortDescription" },
  { key: "translatedLongDescription", label: "Description longue", sourceKey: "longDescription" },
  { key: "translatedSeoTitle", label: "Titre SEO", sourceKey: "seoTitle" },
  { key: "translatedSeoDescription", label: "Meta description SEO", sourceKey: "seoDescription" },
];

/* ══════════════════════════════════════════════════════
   Offer selector component
   ══════════════════════════════════════════════════════ */

function OfferSelector({ offers, value, onChange }: { offers: Offer[]; value: string; onChange: (id: string) => void }) {
  const selected = offers.find(o => o.id === value);
  return (
    <div className="space-y-1.5">
      <label className="text-[12px] font-medium text-neutral-500 dark:text-neutral-400">Offre</label>
      <div className="relative">
        <select value={value} onChange={e => onChange(e.target.value)}
          className="appearance-none w-full h-10 pl-3 pr-8 rounded-lg text-[13px] bg-white dark:bg-white/[0.04] ring-1 ring-neutral-200/80 dark:ring-white/[0.08] text-neutral-700 dark:text-neutral-300 outline-none cursor-pointer hover:ring-neutral-300 dark:hover:ring-white/[0.12] transition-all">
          <option value="">Selectionner une offre...</option>
          {offers.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
        </select>
        <svg className="absolute right-2.5 top-1/2 -translate-y-1/2 size-3.5 text-neutral-400 pointer-events-none" viewBox="0 0 20 20" fill="none"><path d="M6 8l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
      </div>
      {selected && (
        <p className="text-[11px] text-neutral-400 dark:text-neutral-500 truncate">
          {selected.status} · {selected.promotionalPrice ? `${Number(selected.promotionalPrice).toLocaleString()} ${selected.currency}` : "Prix non defini"} · {selected.targetSegment || "Pas de segment"}
        </p>
      )}
    </div>
  );
}

/* ══════════════════════════════════════════════════════
   Sparkle icon
   ══════════════════════════════════════════════════════ */

function SparkleIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 20 20" fill="none">
      <path d="M10 2l1.5 4.5L16 8l-4.5 1.5L10 14l-1.5-4.5L4 8l4.5-1.5L10 2z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
      <path d="M15 12l.75 2.25L18 15l-2.25.75L15 18l-.75-2.25L12 15l2.25-.75L15 12z" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round" />
    </svg>
  );
}

/* ══════════════════════════════════════════════════════
   Main component
   ══════════════════════════════════════════════════════ */

export default function AiPage() {
  const t = useTranslations("ai");
  const [tab, setTab] = useState<Tab>("generate");
  const [offers, setOffers] = useState<Offer[]>([]);
  const [offersLoading, setOffersLoading] = useState(true);
  const [selectedOfferId, setSelectedOfferId] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isDark, setIsDark] = useState(false);

  const [tone, setTone] = useState<string>("professionnel");
  const [audience, setAudience] = useState("");
  const [language, setLanguage] = useState("fr");
  const [generatedContent, setGeneratedContent] = useState<GeneratedContent | null>(null);

  const [qualityReport, setQualityReport] = useState<QualityReport | null>(null);
  const [pricingSuggestion, setPricingSuggestion] = useState<PricingSuggestion | null>(null);
  const [anomalyReport, setAnomalyReport] = useState<AnomalyReport | null>(null);
  const [severityFilter, setSeverityFilter] = useState<string>("ALL");

  const [targetLang, setTargetLang] = useState("en");
  const [translationResult, setTranslationResult] = useState<TranslationResult | null>(null);

  const [usageStats, setUsageStats] = useState<UsageStats | null>(null);
  const [usageDays, setUsageDays] = useState(30);

  useEffect(() => {
    const check = () => setIsDark(document.documentElement.classList.contains("dark"));
    check();
    const obs = new MutationObserver(check);
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
    return () => obs.disconnect();
  }, []);

  useEffect(() => {
    setOffersLoading(true);
    api.get("/offers").then(r => {
      const data = r.data.content ?? r.data ?? [];
      setOffers(Array.isArray(data) ? data : []);
    }).catch(() => {}).finally(() => setOffersLoading(false));
  }, []);

  const selectedOffer = useMemo(() => offers.find(o => o.id === selectedOfferId) || null, [offers, selectedOfferId]);

  const extractError = (e: unknown): string => {
    const axErr = e as { response?: { data?: { message?: string } } };
    return axErr?.response?.data?.message || "Une erreur est survenue. Reessayez.";
  };

  const requireOffer = useCallback(() => {
    if (!selectedOfferId) { toast.error("Veuillez selectionner une offre."); return false; }
    return true;
  }, [selectedOfferId]);

  /* ── API handlers ── */

  const handleGenerate = async () => {
    if (!requireOffer()) return;
    setLoading(true); setError(null); setGeneratedContent(null);
    try {
      const { data } = await api.post("/ai/generate-content", { offerId: selectedOfferId, tone, targetAudience: audience || null, language });
      setGeneratedContent(data);
      toast.success("Contenu genere avec succes !");
    } catch (e) { setError(extractError(e)); }
    finally { setLoading(false); }
  };

  const handleApplyContent = async () => {
    if (!generatedContent || !selectedOfferId) return;
    try {
      await api.patch(`/offers/${selectedOfferId}`, {
        shortDescription: generatedContent.shortDescription,
        longDescription: generatedContent.longDescription,
        seoTitle: generatedContent.seoTitle,
        seoDescription: generatedContent.seoDescription,
        legalMentions: generatedContent.legalMentions,
      });
      toast.success("Contenu applique a l'offre !");
    } catch { toast.error("Erreur lors de l'application."); }
  };

  const handleQuality = async () => {
    if (!requireOffer()) return;
    setLoading(true); setError(null); setQualityReport(null);
    try {
      const { data } = await api.post(`/ai/quality-score/${selectedOfferId}`);
      setQualityReport(data);
    } catch (e) { setError(extractError(e)); }
    finally { setLoading(false); }
  };

  const handlePricing = async () => {
    if (!requireOffer()) return;
    setLoading(true); setError(null); setPricingSuggestion(null);
    try {
      const { data } = await api.post(`/ai/suggest-pricing/${selectedOfferId}`);
      setPricingSuggestion(data);
    } catch (e) { setError(extractError(e)); }
    finally { setLoading(false); }
  };

  const handleAnomalies = async () => {
    setLoading(true); setError(null); setAnomalyReport(null);
    try {
      const { data } = await api.post("/ai/detect-anomalies");
      setAnomalyReport(data);
    } catch (e) { setError(extractError(e)); }
    finally { setLoading(false); }
  };

  const handleTranslate = async () => {
    if (!requireOffer()) return;
    setLoading(true); setError(null); setTranslationResult(null);
    try {
      const { data } = await api.post("/ai/translate", { offerId: selectedOfferId, targetLanguage: targetLang });
      setTranslationResult(data);
    } catch (e) { setError(extractError(e)); }
    finally { setLoading(false); }
  };

  const loadUsage = useCallback(async (days: number) => {
    setLoading(true); setError(null);
    try {
      const { data } = await api.get(`/ai/usage?days=${days}`);
      setUsageStats(data);
    } catch (e) { setError(extractError(e)); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { if (tab === "usage") loadUsage(usageDays); }, [tab, usageDays, loadUsage]);

  /* ── Computed ── */

  const filteredAnomalies = useMemo(() => {
    if (!anomalyReport) return [];
    if (severityFilter === "ALL") return anomalyReport.anomalies;
    return anomalyReport.anomalies.filter(a => a.severity === severityFilter);
  }, [anomalyReport, severityFilter]);

  const anomalySeverityCounts = useMemo(() => {
    if (!anomalyReport) return {};
    const counts: Record<string, number> = {};
    anomalyReport.anomalies.forEach(a => (counts[a.severity] = (counts[a.severity] || 0) + 1));
    return counts;
  }, [anomalyReport]);

  const taskChartData = useMemo(() => {
    if (!usageStats) return [];
    return Object.entries(usageStats.requestsByTask).map(([task, count]) => ({
      name: task.replace(/_/g, " ").toLowerCase(),
      value: count as number,
      fill: TASK_HEX[task] || "#94a3b8",
    }));
  }, [usageStats]);

  const dayChartData = useMemo(() => {
    if (!usageStats) return [];
    return Object.entries(usageStats.requestsByDay).map(([day, count]) => ({
      name: day.slice(5),
      value: count as number,
    }));
  }, [usageStats]);

  const successRate = useMemo(() => {
    if (!usageStats || usageStats.totalRequests === 0) return 0;
    return Math.round((usageStats.successfulRequests / usageStats.totalRequests) * 100);
  }, [usageStats]);

  const gridStroke = isDark ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.04)";
  const axisFill = isDark ? "#525252" : "#a3a3a3";

  /* ── Tab config ── */

  const TABS: { key: Tab; label: string; icon: React.ReactNode }[] = [
    { key: "generate", label: t("tabs.generate"), icon: <svg className="size-3.5" viewBox="0 0 20 20" fill="none"><path d="M10 2l1.5 4.5L16 8l-4.5 1.5L10 14l-1.5-4.5L4 8l4.5-1.5L10 2z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" /></svg> },
    { key: "quality", label: t("tabs.quality"), icon: <svg className="size-3.5" viewBox="0 0 20 20" fill="none"><path d="M10 2l2 6h6l-5 4 2 6-5-4-5 4 2-6-5-4h6z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" /></svg> },
    { key: "pricing", label: t("tabs.pricing"), icon: <svg className="size-3.5" viewBox="0 0 20 20" fill="none"><path d="M10 3v14M6 7h8M7 11h6" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" /></svg> },
    { key: "anomalies", label: t("tabs.anomalies"), icon: <svg className="size-3.5" viewBox="0 0 20 20" fill="none"><path d="M10 3l8 14H2z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" /><path d="M10 9v3M10 14.5v.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" /></svg> },
    { key: "translate", label: t("tabs.translate"), icon: <svg className="size-3.5" viewBox="0 0 20 20" fill="none"><path d="M3 5h8M7 3v2M5 5c0 3 2 5 5 7M9 5c-1.5 3-4 5-6 6" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" /><path d="M11 18l2.5-7L16 18M12 16h3" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" /></svg> },
    { key: "usage", label: t("tabs.usage"), icon: <svg className="size-3.5" viewBox="0 0 20 20" fill="none"><rect x="2" y="10" width="3" height="7" rx="0.5" stroke="currentColor" strokeWidth="1.3" /><rect x="8.5" y="6" width="3" height="11" rx="0.5" stroke="currentColor" strokeWidth="1.3" /><rect x="15" y="3" width="3" height="14" rx="0.5" stroke="currentColor" strokeWidth="1.3" /></svg> },
  ];

  const retryHandler = tab === "generate" ? handleGenerate : tab === "quality" ? handleQuality : tab === "pricing" ? handlePricing : tab === "anomalies" ? handleAnomalies : tab === "translate" ? handleTranslate : () => loadUsage(usageDays);

  /* ══════════════════════════════════════════════════ */

  return (
    <div className="flex flex-col gap-6 max-w-[1360px] mx-auto pb-10">

      {/* ═══ HEADER ═══ */}
      <div className="flex items-center justify-between animate-enter-up stagger-1">
        <div className="flex items-center gap-3">
          <div className="size-10 rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center text-white shadow-lg shadow-violet-500/20">
            <SparkleIcon className="size-5" />
          </div>
          <div>
            <h1 className="text-lg font-semibold tracking-tight text-neutral-900 dark:text-white">{t("title")}</h1>
            <p className="text-[13px] text-neutral-500 dark:text-neutral-500 mt-0.5">{t("subtitle")}</p>
          </div>
        </div>
      </div>

      {/* ═══ CHAT BANNER ═══ */}
      <Link href="/ai/chat"
        className="flex items-center gap-4 p-4 surface rounded-xl animate-enter-up stagger-2 group hover:ring-violet-300 dark:hover:ring-violet-500/30 transition-all">
        <div className="size-10 rounded-xl bg-gradient-to-br from-violet-500/10 to-purple-500/10 dark:from-violet-500/20 dark:to-purple-500/20 flex items-center justify-center shrink-0 group-hover:from-violet-500/20 group-hover:to-purple-500/20 dark:group-hover:from-violet-500/30 dark:group-hover:to-purple-500/30 transition-colors">
          <svg className="size-5 text-violet-500" viewBox="0 0 20 20" fill="none">
            <path d="M4 4h12a1 1 0 011 1v8a1 1 0 01-1 1H8l-4 3v-3a1 1 0 01-1-1V5a1 1 0 011-1z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" />
            <path d="M7 8h6M7 11h4" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
          </svg>
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[13px] font-medium text-neutral-900 dark:text-white">{t("chatBanner")}</p>
          <p className="text-[12px] text-neutral-500 dark:text-neutral-400">{t("chatBannerSub")}</p>
        </div>
        <svg className="size-4 text-neutral-300 dark:text-neutral-600 group-hover:text-violet-400 transition-colors shrink-0" viewBox="0 0 20 20" fill="none">
          <path d="M8 4l6 6-6 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </Link>

      {/* ═══ TABS ═══ */}
      <div className="flex gap-1 p-1 bg-neutral-100 dark:bg-white/[0.04] rounded-xl w-fit animate-enter-up stagger-2 overflow-x-auto">
        {TABS.map(tb => (
          <button key={tb.key} onClick={() => { setTab(tb.key); setError(null); }}
            className={`flex items-center gap-1.5 px-3.5 py-2 text-[12px] font-medium rounded-lg transition-all whitespace-nowrap ${
              tab === tb.key
                ? "bg-white dark:bg-white/[0.1] text-neutral-900 dark:text-white shadow-sm"
                : "text-neutral-500 dark:text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-300"
            }`}>
            {tb.icon}
            {tb.label}
          </button>
        ))}
      </div>

      {/* ═══ ERROR BANNER ═══ */}
      {error && <ErrorBanner message={error} onRetry={retryHandler} />}

      {/* ═══ LOADING PULSE ═══ */}
      {loading && (
        <div className="flex items-center gap-3 py-3">
          <div className="size-5 rounded-full border-2 border-violet-500 border-t-transparent animate-spin" />
          <p className="text-[13px] text-neutral-500 dark:text-neutral-400">Analyse en cours...</p>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════
           GENERATE
         ═══════════════════════════════════════════════════════════════ */}
      {tab === "generate" && (
        <Reveal>
          <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
            {/* Form */}
            <div className="surface lg:col-span-2 p-5 space-y-4">
              <div>
                <p className="text-[13px] font-medium text-neutral-900 dark:text-white mb-1">{t("generate.title")}</p>
                <p className="text-[12px] text-neutral-500 dark:text-neutral-400">{t("generate.description")}</p>
              </div>

              {offersLoading ? <Skeleton className="w-full h-10" /> : <OfferSelector offers={offers} value={selectedOfferId} onChange={setSelectedOfferId} />}

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-[12px] font-medium text-neutral-500 dark:text-neutral-400">{t("generate.tone")}</label>
                  <div className="relative">
                    <select value={tone} onChange={e => setTone(e.target.value)}
                      className="appearance-none w-full h-10 pl-3 pr-8 rounded-lg text-[13px] bg-white dark:bg-white/[0.04] ring-1 ring-neutral-200/80 dark:ring-white/[0.08] text-neutral-700 dark:text-neutral-300 outline-none cursor-pointer hover:ring-neutral-300 dark:hover:ring-white/[0.12] transition-all">
                      {TONES.map(v => <option key={v} value={v}>{t(`generate.tones.${v}`)}</option>)}
                    </select>
                    <svg className="absolute right-2.5 top-1/2 -translate-y-1/2 size-3.5 text-neutral-400 pointer-events-none" viewBox="0 0 20 20" fill="none"><path d="M6 8l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
                  </div>
                </div>
                <div className="space-y-1.5">
                  <label className="text-[12px] font-medium text-neutral-500 dark:text-neutral-400">{t("generate.language")}</label>
                  <div className="relative">
                    <select value={language} onChange={e => setLanguage(e.target.value)}
                      className="appearance-none w-full h-10 pl-3 pr-8 rounded-lg text-[13px] bg-white dark:bg-white/[0.04] ring-1 ring-neutral-200/80 dark:ring-white/[0.08] text-neutral-700 dark:text-neutral-300 outline-none cursor-pointer hover:ring-neutral-300 dark:hover:ring-white/[0.12] transition-all">
                      {LANGUAGES.map(l => <option key={l.code} value={l.code}>{l.label}</option>)}
                    </select>
                    <svg className="absolute right-2.5 top-1/2 -translate-y-1/2 size-3.5 text-neutral-400 pointer-events-none" viewBox="0 0 20 20" fill="none"><path d="M6 8l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
                  </div>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-[12px] font-medium text-neutral-500 dark:text-neutral-400">{t("generate.audience")}</label>
                <input value={audience} onChange={e => setAudience(e.target.value)}
                  className="w-full h-10 px-3 rounded-lg text-[13px] bg-white dark:bg-white/[0.04] ring-1 ring-neutral-200/80 dark:ring-white/[0.08] text-neutral-700 dark:text-neutral-300 outline-none placeholder:text-neutral-400 hover:ring-neutral-300 dark:hover:ring-white/[0.12] focus:ring-violet-400 transition-all"
                  placeholder="ex: jeunes urbains 18-35 ans" />
              </div>

              <button onClick={handleGenerate} disabled={loading || !selectedOfferId}
                className="primary-icon w-full h-10 !rounded-lg disabled:opacity-50 disabled:cursor-not-allowed">
                <span className="flex items-center justify-center gap-2">
                  {loading && <div className="size-4 rounded-full border-2 border-white border-t-transparent animate-spin" />}
                  <span className="text-[13px] font-medium">{loading ? t("generate.generating") : t("generate.submit")}</span>
                </span>
              </button>
            </div>

            {/* Results */}
            <div className="lg:col-span-3">
              {!generatedContent && !loading && (
                <div className="surface h-full flex items-center justify-center min-h-[300px]">
                  <EmptyState
                    icon={<SparkleIcon className="size-5 text-violet-400" />}
                    message="Selectionnez une offre et lancez la generation"
                  />
                </div>
              )}

              {loading && !generatedContent && (
                <div className="surface p-5 space-y-4">
                  {Array.from({ length: 4 }, (_, i) => (
                    <div key={i} className="space-y-2">
                      <Skeleton className="w-24 h-3" />
                      <Skeleton className="w-full h-16" />
                    </div>
                  ))}
                </div>
              )}

              {generatedContent && (
                <div className="surface p-5 space-y-4">
                  <div className="flex items-center justify-between">
                    <p className="text-[13px] font-medium text-neutral-900 dark:text-white">{t("generate.result")}</p>
                    <button onClick={handleApplyContent}
                      className="flex items-center gap-1.5 h-8 px-3 rounded-lg text-[12px] font-medium bg-emerald-500 text-white hover:bg-emerald-600 transition-colors">
                      <svg className="size-3.5" viewBox="0 0 20 20" fill="none"><path d="M5 10l3 3 7-7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
                      {t("generate.applyTitle")}
                    </button>
                  </div>
                  {GENERATED_FIELDS.map(({ key, label }) => (
                    <div key={key} className="space-y-1.5">
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] font-medium text-neutral-500 dark:text-neutral-400 uppercase tracking-wider">{label}</span>
                        <CopyButton text={generatedContent[key] || ""} />
                      </div>
                      <div className="text-[13px] text-neutral-700 dark:text-neutral-300 bg-neutral-50 dark:bg-white/[0.03] rounded-lg p-3 leading-relaxed whitespace-pre-wrap">
                        {generatedContent[key] || <span className="text-neutral-400 italic">Non genere</span>}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </Reveal>
      )}

      {/* ═══════════════════════════════════════════════════════════════
           QUALITY
         ═══════════════════════════════════════════════════════════════ */}
      {tab === "quality" && (
        <Reveal>
          <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
            {/* Form */}
            <div className="surface lg:col-span-2 p-5 space-y-4">
              <div>
                <p className="text-[13px] font-medium text-neutral-900 dark:text-white mb-1">{t("quality.title")}</p>
                <p className="text-[12px] text-neutral-500 dark:text-neutral-400">{t("quality.description")}</p>
              </div>
              {offersLoading ? <Skeleton className="w-full h-10" /> : <OfferSelector offers={offers} value={selectedOfferId} onChange={setSelectedOfferId} />}
              <button onClick={handleQuality} disabled={loading || !selectedOfferId}
                className="primary-icon w-full h-10 !rounded-lg disabled:opacity-50 disabled:cursor-not-allowed">
                <span className="flex items-center justify-center gap-2">
                  {loading && <div className="size-4 rounded-full border-2 border-white border-t-transparent animate-spin" />}
                  <span className="text-[13px] font-medium">{loading ? t("quality.analyzing") : t("quality.submit")}</span>
                </span>
              </button>
            </div>

            {/* Results */}
            <div className="lg:col-span-3">
              {!qualityReport && !loading && (
                <div className="surface h-full flex items-center justify-center min-h-[300px]">
                  <EmptyState
                    icon={<svg className="size-5 text-blue-400" viewBox="0 0 20 20" fill="none"><path d="M10 2l2 6h6l-5 4 2 6-5-4-5 4 2-6-5-4h6z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" /></svg>}
                    message="Analysez la qualite d'une offre"
                  />
                </div>
              )}

              {loading && !qualityReport && (
                <div className="surface p-5 space-y-4">
                  <div className="flex justify-center"><Skeleton className="size-[140px] rounded-full" /></div>
                  {Array.from({ length: 3 }, (_, i) => <Skeleton key={i} className="w-full h-10" />)}
                </div>
              )}

              {qualityReport && (
                <div className="surface p-5 space-y-5">
                  <div className="flex items-center gap-6">
                    <ScoreGauge score={qualityReport.overallScore} grade={qualityReport.grade} />
                    <div className="flex-1 space-y-3">
                      {qualityReport.criteria.map((c, i) => (
                        <div key={i}>
                          <div className="flex items-center justify-between mb-1.5">
                            <span className="text-[12px] font-medium text-neutral-700 dark:text-neutral-300">{c.name}</span>
                            <span className="text-[12px] font-semibold text-neutral-900 dark:text-white tabular-nums">{c.score}/{c.maxScore}</span>
                          </div>
                          <ProgressBar value={(c.score / c.maxScore) * 100} color={c.score / c.maxScore >= 0.7 ? "bg-emerald-500" : c.score / c.maxScore >= 0.4 ? "bg-amber-500" : "bg-red-500"} height="h-[6px]" />
                          <p className="text-[11px] text-neutral-400 dark:text-neutral-500 mt-1">{c.feedback}</p>
                        </div>
                      ))}
                    </div>
                  </div>

                  {qualityReport.suggestions.length > 0 && (
                    <div className="pt-3 border-t border-neutral-100 dark:border-white/[0.04]">
                      <p className="text-[12px] font-medium text-neutral-900 dark:text-white mb-3">{t("quality.suggestions")}</p>
                      <div className="space-y-2">
                        {qualityReport.suggestions.map((s, i) => (
                          <div key={i} className="flex items-start gap-2.5 py-1.5">
                            <svg className="size-4 text-amber-500 shrink-0 mt-0.5" viewBox="0 0 20 20" fill="none"><path d="M10 2v2M10 16v2M4 10H2M18 10h-2M5.6 5.6l-1.4-1.4M15.8 15.8l-1.4-1.4M14.4 5.6l1.4-1.4M4.2 15.8l1.4-1.4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" /><circle cx="10" cy="10" r="3" stroke="currentColor" strokeWidth="1.5" /></svg>
                            <p className="text-[12px] text-neutral-600 dark:text-neutral-300 leading-relaxed">{s}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </Reveal>
      )}

      {/* ═══════════════════════════════════════════════════════════════
           PRICING
         ═══════════════════════════════════════════════════════════════ */}
      {tab === "pricing" && (
        <Reveal>
          <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
            {/* Form */}
            <div className="surface lg:col-span-2 p-5 space-y-4">
              <div>
                <p className="text-[13px] font-medium text-neutral-900 dark:text-white mb-1">{t("pricing.title")}</p>
                <p className="text-[12px] text-neutral-500 dark:text-neutral-400">{t("pricing.description")}</p>
              </div>
              {offersLoading ? <Skeleton className="w-full h-10" /> : <OfferSelector offers={offers} value={selectedOfferId} onChange={setSelectedOfferId} />}
              <button onClick={handlePricing} disabled={loading || !selectedOfferId}
                className="primary-icon w-full h-10 !rounded-lg disabled:opacity-50 disabled:cursor-not-allowed">
                <span className="flex items-center justify-center gap-2">
                  {loading && <div className="size-4 rounded-full border-2 border-white border-t-transparent animate-spin" />}
                  <span className="text-[13px] font-medium">{loading ? t("pricing.analyzing") : t("pricing.submit")}</span>
                </span>
              </button>
            </div>

            {/* Results */}
            <div className="lg:col-span-3">
              {!pricingSuggestion && !loading && (
                <div className="surface h-full flex items-center justify-center min-h-[300px]">
                  <EmptyState
                    icon={<svg className="size-5 text-amber-400" viewBox="0 0 20 20" fill="none"><path d="M10 3v14M6 7h8M7 11h6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" /></svg>}
                    message="Obtenez une suggestion de prix pour votre offre"
                  />
                </div>
              )}

              {loading && !pricingSuggestion && (
                <div className="surface p-5 space-y-4">
                  <Skeleton className="w-full h-24" />
                  <Skeleton className="w-full h-32" />
                </div>
              )}

              {pricingSuggestion && (
                <div className="surface p-5 space-y-5">
                  {/* Price hero */}
                  <div className="text-center py-4">
                    <p className="text-[11px] font-medium text-neutral-500 dark:text-neutral-400 uppercase tracking-wider mb-2">{t("pricing.suggestedPrice")}</p>
                    <p className="text-3xl font-bold text-neutral-900 dark:text-white tabular-nums">
                      {Number(pricingSuggestion.suggestedPrice).toLocaleString()} <span className="text-lg font-medium text-neutral-400">{pricingSuggestion.currency}</span>
                    </p>
                  </div>

                  {/* Price range bar */}
                  <div className="px-4">
                    <div className="relative h-2 rounded-full bg-neutral-100 dark:bg-white/[0.06]">
                      <div className="absolute h-full rounded-full bg-gradient-to-r from-amber-400 to-emerald-400"
                        style={{
                          left: `${Math.max(0, (pricingSuggestion.minPrice / pricingSuggestion.maxPrice) * 100 - 5)}%`,
                          width: `${Math.min(100, 100 - (pricingSuggestion.minPrice / pricingSuggestion.maxPrice) * 100 + 10)}%`,
                        }} />
                      <div className="absolute top-1/2 -translate-y-1/2 size-4 rounded-full bg-white dark:bg-neutral-800 ring-2 ring-emerald-500 shadow-lg"
                        style={{ left: `${(pricingSuggestion.suggestedPrice / pricingSuggestion.maxPrice) * 100}%`, transform: "translate(-50%, -50%)" }} />
                    </div>
                    <div className="flex justify-between mt-2">
                      <span className="text-[11px] text-neutral-400 tabular-nums">{Number(pricingSuggestion.minPrice).toLocaleString()} {pricingSuggestion.currency}</span>
                      <span className="text-[11px] text-neutral-400 tabular-nums">{Number(pricingSuggestion.maxPrice).toLocaleString()} {pricingSuggestion.currency}</span>
                    </div>
                  </div>

                  {/* Rationale */}
                  <div className="rounded-lg bg-neutral-50 dark:bg-white/[0.03] p-4">
                    <p className="text-[12px] font-medium text-neutral-900 dark:text-white mb-2">{t("pricing.rationale")}</p>
                    <p className="text-[13px] text-neutral-600 dark:text-neutral-300 leading-relaxed">{pricingSuggestion.rationale}</p>
                  </div>

                  {/* Price points */}
                  {pricingSuggestion.pricePoints.length > 0 && (
                    <div>
                      <p className="text-[12px] font-medium text-neutral-900 dark:text-white mb-3">{t("pricing.pricePoints")}</p>
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        {pricingSuggestion.pricePoints.map((pp, i) => (
                          <div key={i} className={`rounded-xl p-4 text-center ${i === 1 ? "ring-2 ring-emerald-500/50 bg-emerald-50/50 dark:bg-emerald-500/5" : "bg-neutral-50 dark:bg-white/[0.03]"}`}>
                            <p className="text-[11px] font-medium text-neutral-500 dark:text-neutral-400 uppercase tracking-wider mb-2">{pp.label}</p>
                            <p className="text-xl font-bold text-neutral-900 dark:text-white tabular-nums">{Number(pp.price).toLocaleString()}</p>
                            <p className="text-[11px] text-neutral-400 mb-2">XOF</p>
                            <p className="text-[11px] text-neutral-500 dark:text-neutral-400 leading-relaxed">{pp.description}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </Reveal>
      )}

      {/* ═══════════════════════════════════════════════════════════════
           ANOMALIES
         ═══════════════════════════════════════════════════════════════ */}
      {tab === "anomalies" && (
        <Reveal>
          <div className="space-y-4">
            {/* Launch + summary */}
            <div className="flex flex-col sm:flex-row gap-4">
              <div className="surface p-5 flex-1 max-w-md space-y-3">
                <p className="text-[13px] font-medium text-neutral-900 dark:text-white">{t("anomalies.title")}</p>
                <p className="text-[12px] text-neutral-500 dark:text-neutral-400">{t("anomalies.description")}</p>
                <button onClick={handleAnomalies} disabled={loading}
                  className="primary-icon w-full h-10 !rounded-lg disabled:opacity-50">
                  <span className="flex items-center justify-center gap-2">
                    {loading && <div className="size-4 rounded-full border-2 border-white border-t-transparent animate-spin" />}
                    <span className="text-[13px] font-medium">{loading ? t("anomalies.detecting") : t("anomalies.submit")}</span>
                  </span>
                </button>
              </div>

              {anomalyReport && (
                <RevealGroup stagger={80} className="flex gap-3 flex-1">
                  <div className="surface p-4 flex-1 text-center">
                    <p className="text-2xl font-semibold text-neutral-900 dark:text-white tabular-nums"><AnimatedNumber value={anomalyReport.totalChecked} /></p>
                    <p className="text-[11px] text-neutral-400 dark:text-neutral-500 mt-1">{t("anomalies.totalChecked")}</p>
                  </div>
                  <div className="surface p-4 flex-1 text-center">
                    <p className={`text-2xl font-semibold tabular-nums ${anomalyReport.anomalyCount > 0 ? "text-red-500" : "text-emerald-500"}`}>
                      <AnimatedNumber value={anomalyReport.anomalyCount} />
                    </p>
                    <p className="text-[11px] text-neutral-400 dark:text-neutral-500 mt-1">{t("anomalies.anomalyCount")}</p>
                  </div>
                  {Object.entries(anomalySeverityCounts).map(([sev, count]) => (
                    <div key={sev} className="surface p-4 flex-1 text-center">
                      <p className="text-2xl font-semibold tabular-nums" style={{ color: SEVERITY_CONFIG[sev]?.hex }}><AnimatedNumber value={count as number} /></p>
                      <p className="text-[11px] text-neutral-400 dark:text-neutral-500 mt-1">{sev}</p>
                    </div>
                  ))}
                </RevealGroup>
              )}
            </div>

            {/* Filter + list */}
            {anomalyReport && anomalyReport.anomalies.length > 0 && (
              <>
                <div className="flex h-8 rounded-lg bg-neutral-100 dark:bg-white/[0.04] p-0.5 w-fit">
                  {["ALL", "CRITICAL", "HIGH", "MEDIUM", "LOW"].map(sev => (
                    <button key={sev} onClick={() => setSeverityFilter(sev)}
                      className={`px-3 rounded-md text-[12px] font-medium transition-all ${severityFilter === sev ? "bg-white dark:bg-white/[0.1] text-neutral-900 dark:text-white shadow-sm" : "text-neutral-500 dark:text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-300"}`}>
                      {sev === "ALL" ? `Tous (${anomalyReport.anomalyCount})` : `${sev} (${anomalySeverityCounts[sev] || 0})`}
                    </button>
                  ))}
                </div>

                <div className="space-y-3">
                  {filteredAnomalies.map((a, i) => {
                    const cfg = SEVERITY_CONFIG[a.severity] || SEVERITY_CONFIG.LOW;
                    return (
                      <div key={i} className={`surface p-4 flex items-start gap-4 border-l-[3px]`} style={{ borderLeftColor: cfg.hex }}>
                        <div className={`shrink-0 px-2 py-1 text-[10px] font-bold rounded-md uppercase tracking-wider ${cfg.bg} ${cfg.text}`}>
                          {a.severity}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <p className="text-[13px] font-medium text-neutral-900 dark:text-white truncate">{a.entityName}</p>
                            <span className="text-[10px] text-neutral-400 dark:text-neutral-500 shrink-0">{a.type.replace(/_/g, " ")}</span>
                          </div>
                          <p className="text-[12px] text-neutral-600 dark:text-neutral-300 leading-relaxed">{a.description}</p>
                          <p className="text-[11px] text-violet-500 dark:text-violet-400 mt-2 font-medium">{a.recommendation}</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </>
            )}

            {anomalyReport && anomalyReport.anomalies.length === 0 && (
              <div className="surface p-8 text-center">
                <div className="size-12 rounded-full bg-emerald-50 dark:bg-emerald-500/10 flex items-center justify-center mx-auto mb-3">
                  <svg className="size-6 text-emerald-500" viewBox="0 0 20 20" fill="none"><circle cx="10" cy="10" r="7" stroke="currentColor" strokeWidth="1.5" /><path d="M7 10l2 2 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
                </div>
                <p className="text-[14px] font-medium text-emerald-600 dark:text-emerald-400">{t("anomalies.noAnomalies")}</p>
                <p className="text-[12px] text-neutral-400 mt-1">Toutes les offres sont conformes</p>
              </div>
            )}
          </div>
        </Reveal>
      )}

      {/* ═══════════════════════════════════════════════════════════════
           TRANSLATE
         ═══════════════════════════════════════════════════════════════ */}
      {tab === "translate" && (
        <Reveal>
          <div className="space-y-4">
            <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
              {/* Form */}
              <div className="surface lg:col-span-2 p-5 space-y-4">
                <div>
                  <p className="text-[13px] font-medium text-neutral-900 dark:text-white mb-1">{t("translate.title")}</p>
                  <p className="text-[12px] text-neutral-500 dark:text-neutral-400">{t("translate.description")}</p>
                </div>
                {offersLoading ? <Skeleton className="w-full h-10" /> : <OfferSelector offers={offers} value={selectedOfferId} onChange={setSelectedOfferId} />}
                <div className="space-y-1.5">
                  <label className="text-[12px] font-medium text-neutral-500 dark:text-neutral-400">{t("translate.targetLanguage")}</label>
                  <div className="relative">
                    <select value={targetLang} onChange={e => setTargetLang(e.target.value)}
                      className="appearance-none w-full h-10 pl-3 pr-8 rounded-lg text-[13px] bg-white dark:bg-white/[0.04] ring-1 ring-neutral-200/80 dark:ring-white/[0.08] text-neutral-700 dark:text-neutral-300 outline-none cursor-pointer hover:ring-neutral-300 dark:hover:ring-white/[0.12] transition-all">
                      {TARGET_LANGUAGES.map(l => <option key={l.code} value={l.code}>{l.label}</option>)}
                    </select>
                    <svg className="absolute right-2.5 top-1/2 -translate-y-1/2 size-3.5 text-neutral-400 pointer-events-none" viewBox="0 0 20 20" fill="none"><path d="M6 8l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
                  </div>
                </div>
                <button onClick={handleTranslate} disabled={loading || !selectedOfferId}
                  className="primary-icon w-full h-10 !rounded-lg disabled:opacity-50 disabled:cursor-not-allowed">
                  <span className="flex items-center justify-center gap-2">
                    {loading && <div className="size-4 rounded-full border-2 border-white border-t-transparent animate-spin" />}
                    <span className="text-[13px] font-medium">{loading ? t("translate.translating") : t("translate.submit")}</span>
                  </span>
                </button>
              </div>

              {/* Results */}
              <div className="lg:col-span-3">
                {!translationResult && !loading && (
                  <div className="surface h-full flex items-center justify-center min-h-[300px]">
                    <EmptyState
                      icon={<svg className="size-5 text-pink-400" viewBox="0 0 20 20" fill="none"><path d="M3 5h8M7 3v2M5 5c0 3 2 5 5 7M9 5c-1.5 3-4 5-6 6" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" /><path d="M11 18l2.5-7L16 18M12 16h3" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" /></svg>}
                      message="Traduisez le contenu de vos offres"
                    />
                  </div>
                )}

                {loading && !translationResult && (
                  <div className="surface p-5 space-y-4">
                    {Array.from({ length: 3 }, (_, i) => (
                      <div key={i} className="space-y-2">
                        <Skeleton className="w-20 h-3" />
                        <div className="grid grid-cols-2 gap-3">
                          <Skeleton className="w-full h-16" />
                          <Skeleton className="w-full h-16" />
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {translationResult && (
                  <div className="surface p-5 space-y-4">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-[12px] font-medium text-neutral-500 dark:text-neutral-400 uppercase">{translationResult.sourceLanguage}</span>
                      <svg className="size-4 text-neutral-300 dark:text-neutral-600" viewBox="0 0 20 20" fill="none"><path d="M4 10h12M12 6l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
                      <span className="text-[12px] font-medium text-violet-500 dark:text-violet-400 uppercase">{translationResult.targetLanguage}</span>
                    </div>

                    {TRANSLATION_FIELDS.map(({ key, label, sourceKey }) => (
                      <div key={key} className="space-y-1.5">
                        <span className="text-[11px] font-medium text-neutral-500 dark:text-neutral-400 uppercase tracking-wider">{label}</span>
                        <div className="grid grid-cols-2 gap-3">
                          <div className="text-[12px] text-neutral-500 dark:text-neutral-400 bg-neutral-50 dark:bg-white/[0.02] rounded-lg p-3 leading-relaxed">
                            {(selectedOffer && (selectedOffer[sourceKey] as string)) || <span className="italic">Vide</span>}
                          </div>
                          <div className="text-[13px] text-neutral-700 dark:text-neutral-300 bg-violet-50/50 dark:bg-violet-500/5 rounded-lg p-3 leading-relaxed ring-1 ring-violet-200/30 dark:ring-violet-500/10">
                            <div className="flex justify-between items-start gap-2">
                              <span className="flex-1">{translationResult[key]}</span>
                              <CopyButton text={translationResult[key] || ""} />
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </Reveal>
      )}

      {/* ═══════════════════════════════════════════════════════════════
           USAGE
         ═══════════════════════════════════════════════════════════════ */}
      {tab === "usage" && (
        <Reveal>
          <div className="space-y-4">
            {/* Period filter */}
            <div className="flex h-8 rounded-lg bg-neutral-100 dark:bg-white/[0.04] p-0.5 w-fit">
              {[7, 14, 30, 90].map(d => (
                <button key={d} onClick={() => setUsageDays(d)}
                  className={`px-3 rounded-md text-[12px] font-medium transition-all ${usageDays === d ? "bg-white dark:bg-white/[0.1] text-neutral-900 dark:text-white shadow-sm" : "text-neutral-500 dark:text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-300"}`}>
                  {d}j
                </button>
              ))}
            </div>

            {!usageStats && loading && (
              <RevealGroup stagger={80} className="grid grid-cols-2 xl:grid-cols-4 gap-4">
                {Array.from({ length: 4 }, (_, i) => <Skeleton key={i} className="h-24" />)}
              </RevealGroup>
            )}

            {usageStats && (
              <>
                {/* KPIs */}
                <RevealGroup stagger={80} className="grid grid-cols-2 xl:grid-cols-4 gap-4">
                  <div className="surface p-5">
                    <p className="text-xs font-medium text-neutral-500 dark:text-neutral-400">{t("usage.totalRequests")}</p>
                    <p className="text-2xl font-semibold text-neutral-900 dark:text-white tabular-nums mt-2 leading-none">
                      <AnimatedNumber value={usageStats.totalRequests} />
                    </p>
                  </div>
                  <div className="surface p-5">
                    <p className="text-xs font-medium text-neutral-500 dark:text-neutral-400">{t("usage.successRate")}</p>
                    <div className="flex items-end gap-2 mt-2">
                      <p className="text-2xl font-semibold text-emerald-500 tabular-nums leading-none">
                        <AnimatedNumber value={successRate} suffix="%" />
                      </p>
                    </div>
                    <div className="mt-3"><ProgressBar value={successRate} color="bg-emerald-500" /></div>
                  </div>
                  <div className="surface p-5">
                    <p className="text-xs font-medium text-neutral-500 dark:text-neutral-400">{t("usage.totalTokens")}</p>
                    <p className="text-2xl font-semibold text-neutral-900 dark:text-white tabular-nums mt-2 leading-none">
                      {((usageStats.totalInputTokens + usageStats.totalOutputTokens) / 1000).toFixed(1)}k
                    </p>
                    <p className="text-[11px] text-neutral-400 mt-1">
                      {(usageStats.totalInputTokens / 1000).toFixed(1)}k in · {(usageStats.totalOutputTokens / 1000).toFixed(1)}k out
                    </p>
                  </div>
                  <div className="surface p-5">
                    <p className="text-xs font-medium text-neutral-500 dark:text-neutral-400">{t("usage.avgLatency")}</p>
                    <p className="text-2xl font-semibold text-neutral-900 dark:text-white tabular-nums mt-2 leading-none">
                      {usageStats.avgLatencyMs >= 1000 ? `${(usageStats.avgLatencyMs / 1000).toFixed(1)}s` : `${Math.round(usageStats.avgLatencyMs)}ms`}
                    </p>
                  </div>
                </RevealGroup>

                {/* Charts */}
                <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
                  {/* By task */}
                  <div className="surface lg:col-span-2">
                    <div className="px-5 pt-5 pb-2">
                      <p className="text-[13px] font-medium text-neutral-900 dark:text-white">{t("usage.byTask")}</p>
                    </div>
                    {taskChartData.length === 0 ? (
                      <div className="py-10 text-center"><p className="text-[13px] text-neutral-400">Aucune donnee</p></div>
                    ) : (
                      <div className="px-2 pb-4">
                        <ResponsiveContainer width="100%" height={Math.max(120, taskChartData.length * 36)}>
                          <BarChart data={taskChartData} layout="vertical" margin={{ top: 4, right: 12, left: 0, bottom: 0 }}>
                            <XAxis type="number" hide />
                            <YAxis type="category" dataKey="name" tick={{ fontSize: 10, fill: axisFill }} axisLine={false} tickLine={false} width={120} />
                            <Tooltip content={<ChartTooltip />} />
                            <Bar dataKey="value" radius={[0, 4, 4, 0]} barSize={14}>
                              {taskChartData.map((e, i) => <Cell key={i} fill={e.fill} />)}
                            </Bar>
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                    )}
                  </div>

                  {/* By day */}
                  <div className="surface lg:col-span-3">
                    <div className="px-5 pt-5 pb-2">
                      <p className="text-[13px] font-medium text-neutral-900 dark:text-white">{t("usage.byDay")}</p>
                    </div>
                    {dayChartData.length === 0 ? (
                      <div className="py-10 text-center"><p className="text-[13px] text-neutral-400">Aucune donnee</p></div>
                    ) : (
                      <div className="px-2 pb-4">
                        <ResponsiveContainer width="100%" height={200}>
                          <LineChart data={dayChartData} margin={{ top: 8, right: 12, left: -24, bottom: 0 }}>
                            <XAxis dataKey="name" tick={{ fontSize: 10, fill: axisFill }} axisLine={false} tickLine={false} dy={4} />
                            <YAxis allowDecimals={false} tick={{ fontSize: 10, fill: axisFill }} axisLine={false} tickLine={false} />
                            <Tooltip content={<ChartTooltip />} />
                            <Line type="monotone" dataKey="value" name="Requetes" stroke="#8b5cf6" strokeWidth={2}
                              dot={{ r: 3, strokeWidth: 2, stroke: isDark ? "#161616" : "#fff", fill: "#8b5cf6" }}
                              activeDot={{ r: 5, strokeWidth: 2, stroke: isDark ? "#161616" : "#fff", fill: "#8b5cf6" }} />
                          </LineChart>
                        </ResponsiveContainer>
                      </div>
                    )}
                  </div>
                </div>

                {/* Success donut */}
                {usageStats.totalRequests > 0 && (
                  <div className="surface p-5 max-w-xs">
                    <p className="text-[13px] font-medium text-neutral-900 dark:text-white mb-4">Taux de reussite</p>
                    <div className="flex items-center gap-6">
                      <div className="relative">
                        <ResponsiveContainer width={100} height={100}>
                          <PieChart>
                            <Pie data={[
                              { name: "Succes", value: usageStats.successfulRequests, fill: "#10b981" },
                              { name: "Echecs", value: usageStats.failedRequests, fill: "#ef4444" },
                            ]} cx="50%" cy="50%" innerRadius={30} outerRadius={45} paddingAngle={2} dataKey="value" stroke="none">
                              <Cell fill="#10b981" />
                              <Cell fill="#ef4444" />
                            </Pie>
                          </PieChart>
                        </ResponsiveContainer>
                        <div className="absolute inset-0 flex items-center justify-center">
                          <span className="text-[14px] font-bold text-neutral-900 dark:text-white tabular-nums">{successRate}%</span>
                        </div>
                      </div>
                      <div className="space-y-2">
                        <div className="flex items-center gap-2">
                          <span className="size-[6px] rounded-full bg-emerald-500" />
                          <span className="text-[12px] text-neutral-500 dark:text-neutral-400">Succes</span>
                          <span className="text-[12px] font-semibold text-neutral-900 dark:text-white ml-auto tabular-nums">{usageStats.successfulRequests}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="size-[6px] rounded-full bg-red-500" />
                          <span className="text-[12px] text-neutral-500 dark:text-neutral-400">Echecs</span>
                          <span className="text-[12px] font-semibold text-neutral-900 dark:text-white ml-auto tabular-nums">{usageStats.failedRequests}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </>
            )}

            {usageStats && usageStats.totalRequests === 0 && !loading && (
              <div className="surface p-8">
                <EmptyState
                  icon={<svg className="size-5 text-neutral-400" viewBox="0 0 20 20" fill="none"><rect x="2" y="10" width="3" height="7" rx="0.5" stroke="currentColor" strokeWidth="1.3" /><rect x="8.5" y="6" width="3" height="11" rx="0.5" stroke="currentColor" strokeWidth="1.3" /><rect x="15" y="3" width="3" height="14" rx="0.5" stroke="currentColor" strokeWidth="1.3" /></svg>}
                  message="Aucune utilisation IA enregistree sur cette periode"
                />
              </div>
            )}
          </div>
        </Reveal>
      )}
    </div>
  );
}
