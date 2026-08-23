"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import toast from "react-hot-toast";
import api, { apiError } from "@/lib/api";
import type { CatalogItem } from "@/lib/types";

type Tab = "assistant" | "generation" | "insights";
type GenType = "DESCRIPTION" | "TAGS" | "TRANSLATION";
type Tone = "PROFESSIONAL" | "CREATIVE";
type SourceMode = "catalog" | "free";

interface Fact {
  label: string;
  value: string;
}

interface Message {
  id: string;
  role: "user" | "ai";
  content: string;
  facts?: Fact[];
}

interface Recommendation {
  code: string;
  priority: "HIGH" | "MEDIUM" | "LOW";
  category: string;
  title: string;
  detail: string;
  impact: number;
  entityIds: string[];
}

interface Insights {
  qualityScore: number;
  anomalies: number;
  itemsWithoutDescription: number;
  suggestions: number;
  recommendations: Recommendation[];
  penalties: { label: string; points: number }[];
  snapshot: Record<string, number>;
}

interface Generation {
  type: string;
  tone: string;
  language: string;
  content: string;
  source: string;
}

const PRIORITY_STYLES: Record<string, string> = {
  HIGH: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
  MEDIUM: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
  LOW: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
};

const PRIORITY_KEYS: Record<string, string> = {
  HIGH: "high",
  MEDIUM: "medium",
  LOW: "low",
};

const SNAPSHOT_ORDER = [
  "catalogItems",
  "activeCatalogItems",
  "categories",
  "offers",
  "publishedOffers",
  "campaigns",
  "mediaAssets",
  "businessRules",
] as const;

/** Endpoint de mise a jour correspondant au type d'element de catalogue. */
const UPDATE_PATH: Record<string, string> = {
  PRODUCT: "products",
  SERVICE: "services",
  PACK: "packs",
};

function Skeleton({ className }: { className: string }) {
  return <div className={`rounded-lg bg-neutral-100 dark:bg-neutral-800 animate-pulse ${className}`} />;
}

export default function AiPage() {
  const t = useTranslations("ai");
  const tc = useTranslations("common");
  const [tab, setTab] = useState<Tab>("assistant");

  /* ===== SOURCES PARTAGEES ===== */
  const [items, setItems] = useState<CatalogItem[]>([]);

  /* ===== ASSISTANT ===== */
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [typing, setTyping] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  /* ===== GENERATION ===== */
  const [genType, setGenType] = useState<GenType>("DESCRIPTION");
  const [sourceMode, setSourceMode] = useState<SourceMode>("catalog");
  const [selectedItemId, setSelectedItemId] = useState("");
  const [freeSubject, setFreeSubject] = useState("");
  const [genLang, setGenLang] = useState("fr");
  const [genTone, setGenTone] = useState<Tone>("PROFESSIONAL");
  const [generation, setGeneration] = useState<Generation | null>(null);
  const [generating, setGenerating] = useState(false);
  const [applying, setApplying] = useState(false);
  const [copied, setCopied] = useState(false);

  /* ===== INSIGHTS ===== */
  const [insights, setInsights] = useState<Insights | null>(null);
  const [loadingInsights, setLoadingInsights] = useState(true);

  const loadInsights = useCallback(async () => {
    setLoadingInsights(true);
    try {
      const { data } = await api.get<Insights>("/ai/insights");
      setInsights(data);
    } catch (e) {
      toast.error(apiError(e, tc("errors.load")));
    } finally {
      setLoadingInsights(false);
    }
  }, [tc]);

  useEffect(() => {
    loadInsights();
    api
      .get("/catalog", { params: { size: 500 } })
      .then(({ data }) => setItems(Array.isArray(data) ? data : data.content ?? []))
      .catch(() => { /* la generation reste utilisable en mode intitule libre */ });
  }, [loadInsights]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, typing]);

  const SUGGESTIONS = [
    t("assistant.suggestion1"),
    t("assistant.suggestion2"),
    t("assistant.suggestion3"),
    t("assistant.suggestion4"),
  ];

  async function sendMessage(text: string) {
    const question = text.trim();
    if (!question || typing) return;

    setMessages((prev) => [...prev, { id: `u-${Date.now()}`, role: "user", content: question }]);
    setInput("");
    setTyping(true);
    try {
      const { data } = await api.post<{ answer: string; facts: Fact[] }>("/ai/assistant", { question });
      setMessages((prev) => [
        ...prev,
        { id: `a-${Date.now()}`, role: "ai", content: data.answer, facts: data.facts },
      ]);
    } catch (e) {
      const message = apiError(e, t("assistant.error"));
      setMessages((prev) => [...prev, { id: `e-${Date.now()}`, role: "ai", content: message }]);
    } finally {
      setTyping(false);
    }
  }

  async function handleGenerate() {
    setGenerating(true);
    setGeneration(null);
    setCopied(false);
    try {
      const { data } = await api.post<Generation>("/ai/generate", {
        type: genType,
        tone: genTone,
        language: genLang,
        catalogItemId: sourceMode === "catalog" && selectedItemId ? selectedItemId : null,
        subject: sourceMode === "free" ? freeSubject : null,
      });
      setGeneration(data);
    } catch (e) {
      toast.error(apiError(e, t("generation.error")));
    } finally {
      setGenerating(false);
    }
  }

  /**
   * Ecrit la description generee sur l'element du catalogue selectionne.
   * L'endpoint de mise a jour attend la definition complete : on repart de
   * l'element charge et on ne remplace que la description.
   */
  async function handleApply() {
    const item = items.find((i) => i.id === selectedItemId);
    if (!item || !generation) return;

    setApplying(true);
    try {
      const details = (item.details ?? {}) as Record<string, unknown>;
      const payload: Record<string, unknown> = {
        name: item.name,
        description: generation.content,
        basePrice: item.basePrice,
        categoryId: item.categoryId,
        characteristics: details.characteristics ?? "{}",
        packOnly: details.packOnly ?? false,
      };
      if (item.type === "SERVICE") {
        payload.serviceType = details.serviceType;
        payload.billingCycle = details.billingCycle;
      }
      if (item.type === "PACK") {
        payload.bundlePrice = details.bundlePrice;
        payload.bundleDiscount = details.bundleDiscount;
        payload.items = details.items;
      }

      await api.put(`/catalog/${UPDATE_PATH[item.type]}/${item.id}`, payload);
      toast.success(t("generation.applied"));
      setItems((prev) =>
        prev.map((i) => (i.id === item.id ? { ...i, description: generation.content } : i))
      );
      loadInsights();
    } catch (e) {
      toast.error(apiError(e, t("generation.applyError")));
    } finally {
      setApplying(false);
    }
  }

  function copyResult() {
    if (!generation) return;
    navigator.clipboard.writeText(generation.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  const canApply =
    genType === "DESCRIPTION" && sourceMode === "catalog" && !!selectedItemId && !!generation;
  const canGenerate =
    sourceMode === "catalog" ? !!selectedItemId : freeSubject.trim().length > 0;

  const TABS: { key: Tab; label: string; icon: React.ReactNode }[] = [
    {
      key: "assistant",
      label: t("tabs.assistant"),
      icon: (
        <svg className="size-4" viewBox="0 0 20 20" fill="none">
          <path d="M4 4a2 2 0 012-2h8a2 2 0 012 2v8a2 2 0 01-2 2H8l-4 4V4z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
          <path d="M7 7h6M7 10h4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
      ),
    },
    {
      key: "generation",
      label: t("tabs.generation"),
      icon: (
        <svg className="size-4" viewBox="0 0 20 20" fill="none">
          <path d="M10 2l1.5 4.5L16 8l-4.5 1.5L10 14l-1.5-4.5L4 8l4.5-1.5L10 2z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
          <path d="M15 13l.75 2.25L18 16l-2.25.75L15 19l-.75-2.25L12 16l2.25-.75L15 13z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" />
        </svg>
      ),
    },
    {
      key: "insights",
      label: t("tabs.insights"),
      icon: (
        <svg className="size-4" viewBox="0 0 20 20" fill="none">
          <circle cx="10" cy="10" r="8" stroke="currentColor" strokeWidth="1.5" />
          <path d="M10 6v4l3 2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      ),
    },
  ];

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-primary dark:text-white flex items-center gap-3">
          <span className="size-10 rounded-xl bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center">
            <svg className="size-5 text-white" viewBox="0 0 20 20" fill="none">
              <path d="M10 2l1.5 4.5L16 8l-4.5 1.5L10 14l-1.5-4.5L4 8l4.5-1.5L10 2z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
              <path d="M15 13l.75 2.25L18 16l-2.25.75L15 19l-.75-2.25L12 16l2.25-.75L15 13z" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round" />
            </svg>
          </span>
          {t("title")}
        </h1>
        <p className="text-sm text-text-secondary dark:text-neutral-400 mt-1">{t("subtitle")}</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 p-1 bg-neutral-100 dark:bg-neutral-800 rounded-xl w-fit">
        {TABS.map((tb) => (
          <button
            key={tb.key}
            onClick={() => setTab(tb.key)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors cursor-pointer ${
              tab === tb.key
                ? "bg-white dark:bg-neutral-700 text-primary dark:text-white shadow-sm"
                : "text-text-secondary dark:text-neutral-400 hover:text-primary dark:hover:text-white"
            }`}
          >
            {tb.icon}
            {tb.label}
          </button>
        ))}
      </div>

      {/* ===== TAB : ASSISTANT ===== */}
      {tab === "assistant" && (
        <div className="bg-white dark:bg-neutral-900 rounded-2xl border border-border dark:border-neutral-800 shadow-card flex flex-col" style={{ height: "calc(100dvh - 280px)", minHeight: 400 }}>
          <div className="flex-1 overflow-y-auto hide-scrollbar p-6 space-y-4">
            {messages.length === 0 && (
              <div className="h-full flex items-center justify-center text-center">
                <div>
                  <p className="text-sm text-text-secondary dark:text-neutral-400">{t("subtitle")}</p>
                  <p className="text-xs text-text-secondary dark:text-neutral-500 mt-1">{t("poweredBy")}</p>
                </div>
              </div>
            )}
            {messages.map((msg) => (
              <div key={msg.id} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                <div className={`max-w-[75%] rounded-2xl px-4 py-3 text-sm leading-relaxed ${
                  msg.role === "user"
                    ? "bg-primary text-white rounded-br-md"
                    : "bg-neutral-100 dark:bg-neutral-800 text-text-secondary dark:text-neutral-300 rounded-bl-md"
                }`}>
                  {msg.role === "ai" && (
                    <div className="flex items-center gap-2 mb-2">
                      <span className="size-5 rounded-md bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center">
                        <svg className="size-3 text-white" viewBox="0 0 20 20" fill="none">
                          <path d="M10 2l1.5 4.5L16 8l-4.5 1.5L10 14l-1.5-4.5L4 8l4.5-1.5L10 2z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
                        </svg>
                      </span>
                      <span className="text-xs font-semibold text-violet-600 dark:text-violet-400">Moov AI</span>
                    </div>
                  )}
                  {msg.content}
                  {msg.facts && msg.facts.length > 0 && (
                    <div className="mt-3 pt-3 border-t border-neutral-200 dark:border-neutral-700">
                      <p className="text-[10px] font-semibold uppercase tracking-wider text-text-secondary dark:text-neutral-500 mb-2">
                        {t("assistant.sources")}
                      </p>
                      <div className="flex flex-wrap gap-1.5">
                        {msg.facts.map((f) => (
                          <span key={f.label} className="px-2 py-0.5 rounded-md bg-white dark:bg-neutral-900 text-[11px] border border-border dark:border-neutral-700">
                            {f.label} : <span className="font-semibold">{f.value}</span>
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ))}
            {typing && (
              <div className="flex justify-start">
                <div className="bg-neutral-100 dark:bg-neutral-800 rounded-2xl rounded-bl-md px-4 py-3 flex items-center gap-1.5">
                  <div className="size-2 rounded-full bg-neutral-400 animate-bounce" style={{ animationDelay: "0ms" }} />
                  <div className="size-2 rounded-full bg-neutral-400 animate-bounce" style={{ animationDelay: "150ms" }} />
                  <div className="size-2 rounded-full bg-neutral-400 animate-bounce" style={{ animationDelay: "300ms" }} />
                </div>
              </div>
            )}
            <div ref={chatEndRef} />
          </div>

          {messages.length === 0 && (
            <div className="px-6 pb-3 flex flex-wrap gap-2">
              {SUGGESTIONS.map((s, i) => (
                <button
                  key={i}
                  onClick={() => sendMessage(s)}
                  className="px-3 py-1.5 rounded-full text-xs font-medium border border-border dark:border-neutral-700 text-text-secondary dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors cursor-pointer"
                >
                  {s}
                </button>
              ))}
            </div>
          )}

          <div className="border-t border-border dark:border-neutral-800 p-4">
            <div className="flex items-center gap-3">
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && sendMessage(input)}
                placeholder={t("assistant.placeholder")}
                className="input flex-1"
                disabled={typing}
              />
              <button
                onClick={() => sendMessage(input)}
                disabled={!input.trim() || typing}
                className="size-10 rounded-xl bg-primary hover:bg-primary/90 text-white flex items-center justify-center transition-colors disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
              >
                <svg className="size-4" viewBox="0 0 20 20" fill="none">
                  <path d="M3 10h14M12 5l5 5-5 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ===== TAB : GENERATION ===== */}
      {tab === "generation" && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-white dark:bg-neutral-900 rounded-2xl border border-border dark:border-neutral-800 shadow-card p-6 space-y-5">
            <h2 className="text-lg font-semibold text-primary dark:text-white">{t("generation.title")}</h2>

            {/* Type */}
            <div>
              <label className="block text-sm font-medium text-text-secondary dark:text-neutral-400 mb-1.5">{t("generation.type")}</label>
              <div className="flex gap-2">
                {([["DESCRIPTION", "description"], ["TAGS", "tags"], ["TRANSLATION", "translation"]] as const).map(([value, key]) => (
                  <button
                    key={value}
                    onClick={() => setGenType(value)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
                      genType === value ? "bg-primary text-white" : "bg-neutral-100 dark:bg-neutral-800 text-text-secondary dark:text-neutral-400 hover:bg-neutral-200 dark:hover:bg-neutral-700"
                    }`}
                  >
                    {t(`generation.types.${key}`)}
                  </button>
                ))}
              </div>
            </div>

            {/* Source */}
            <div>
              <label className="block text-sm font-medium text-text-secondary dark:text-neutral-400 mb-1.5">{t("generation.source")}</label>
              <div className="flex gap-2 mb-2">
                {([["catalog", t("generation.sourceCatalog")], ["free", t("generation.sourceFree")]] as const).map(([value, label]) => (
                  <button
                    key={value}
                    onClick={() => setSourceMode(value)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
                      sourceMode === value ? "bg-primary text-white" : "bg-neutral-100 dark:bg-neutral-800 text-text-secondary dark:text-neutral-400 hover:bg-neutral-200 dark:hover:bg-neutral-700"
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
              {sourceMode === "catalog" ? (
                <select
                  value={selectedItemId}
                  onChange={(e) => setSelectedItemId(e.target.value)}
                  className="input w-full cursor-pointer"
                >
                  <option value="">{t("generation.selectPlaceholder")}</option>
                  {items.map((i) => (
                    <option key={i.id} value={i.id}>{i.name}</option>
                  ))}
                </select>
              ) : (
                <input
                  type="text"
                  value={freeSubject}
                  onChange={(e) => setFreeSubject(e.target.value)}
                  placeholder={t("generation.productPlaceholder")}
                  className="input w-full"
                />
              )}
            </div>

            {/* Langue */}
            {genType === "TRANSLATION" && (
              <div>
                <label className="block text-sm font-medium text-text-secondary dark:text-neutral-400 mb-1.5">{t("generation.language")}</label>
                <select value={genLang} onChange={(e) => setGenLang(e.target.value)} className="input w-full cursor-pointer">
                  <option value="fr">Français</option>
                  <option value="en">English</option>
                  <option value="ar">العربية</option>
                  <option value="sw">Kiswahili</option>
                </select>
              </div>
            )}

            {/* Ton */}
            <div>
              <label className="block text-sm font-medium text-text-secondary dark:text-neutral-400 mb-1.5">{t("generation.tone")}</label>
              <div className="flex gap-2">
                {([["PROFESSIONAL", "professional"], ["CREATIVE", "creative"]] as const).map(([value, key]) => (
                  <button
                    key={value}
                    onClick={() => setGenTone(value)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
                      genTone === value ? "bg-primary text-white" : "bg-neutral-100 dark:bg-neutral-800 text-text-secondary dark:text-neutral-400 hover:bg-neutral-200 dark:hover:bg-neutral-700"
                    }`}
                  >
                    {t(`generation.tones.${key}`)}
                  </button>
                ))}
              </div>
            </div>

            <button
              onClick={handleGenerate}
              disabled={generating || !canGenerate}
              className="w-full py-2.5 rounded-xl bg-gradient-to-r from-violet-500 to-indigo-600 hover:from-violet-600 hover:to-indigo-700 text-white text-sm font-semibold transition-all disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer flex items-center justify-center gap-2"
            >
              {generating ? (
                <>
                  <svg className="size-4 animate-spin" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" className="opacity-25" /><path d="M4 12a8 8 0 018-8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="opacity-75" /></svg>
                  {t("generation.generating")}
                </>
              ) : (
                <>
                  <svg className="size-4" viewBox="0 0 20 20" fill="none"><path d="M10 2l1.5 4.5L16 8l-4.5 1.5L10 14l-1.5-4.5L4 8l4.5-1.5L10 2z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" /></svg>
                  {t("generation.generate")}
                </>
              )}
            </button>
          </div>

          {/* Résultat */}
          <div className="bg-white dark:bg-neutral-900 rounded-2xl border border-border dark:border-neutral-800 shadow-card p-6 flex flex-col">
            <h2 className="text-lg font-semibold text-primary dark:text-white mb-4">{t("generation.result")}</h2>

            {generation ? (
              <div className="flex-1 flex flex-col">
                <p className="text-[11px] text-text-secondary dark:text-neutral-500 mb-2">
                  {t("generation.basedOn")} : <span className="font-medium">{generation.source}</span>
                </p>
                <div className="flex-1 p-4 rounded-xl bg-neutral-50 dark:bg-neutral-800 text-sm text-text-secondary dark:text-neutral-300 leading-relaxed whitespace-pre-wrap">
                  {generation.content}
                </div>
                <div className="flex gap-2 mt-4">
                  <button
                    onClick={copyResult}
                    className="flex-1 py-2 rounded-xl border border-border dark:border-neutral-700 text-sm font-medium text-text-secondary dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors cursor-pointer flex items-center justify-center gap-2"
                  >
                    <svg className="size-4" viewBox="0 0 20 20" fill="none"><rect x="6" y="6" width="11" height="11" rx="2" stroke="currentColor" strokeWidth="1.5" /><path d="M14 6V4a2 2 0 00-2-2H4a2 2 0 00-2 2v8a2 2 0 002 2h2" stroke="currentColor" strokeWidth="1.5" /></svg>
                    {copied ? t("generation.copied") : t("generation.copy")}
                  </button>
                  {canApply && (
                    <button
                      onClick={handleApply}
                      disabled={applying}
                      className="flex-1 py-2 rounded-xl bg-primary hover:bg-primary/90 text-white text-sm font-medium transition-colors cursor-pointer flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <svg className="size-4" viewBox="0 0 20 20" fill="none"><path d="M5 10l4 4 6-8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
                      {applying ? tc("saving") : t("generation.apply")}
                    </button>
                  )}
                </div>
                {!canApply && genType === "DESCRIPTION" && (
                  <p className="text-[11px] text-text-secondary dark:text-neutral-500 mt-2">{t("generation.applyHint")}</p>
                )}
              </div>
            ) : (
              <div className="flex-1 flex items-center justify-center text-text-secondary dark:text-neutral-500">
                <div className="text-center">
                  <svg className="size-12 mx-auto mb-3 opacity-30" viewBox="0 0 20 20" fill="none">
                    <path d="M10 2l1.5 4.5L16 8l-4.5 1.5L10 14l-1.5-4.5L4 8l4.5-1.5L10 2z" stroke="currentColor" strokeWidth="1" strokeLinejoin="round" />
                    <path d="M15 13l.75 2.25L18 16l-2.25.75L15 19l-.75-2.25L12 16l2.25-.75L15 13z" stroke="currentColor" strokeWidth="1" strokeLinejoin="round" />
                  </svg>
                  <p className="text-sm">{t("generation.emptyState")}</p>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ===== TAB : INSIGHTS ===== */}
      {tab === "insights" && (
        <div className="space-y-6">
          {loadingInsights || !insights ? (
            <>
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-28" />)}
              </div>
              <Skeleton className="h-64" />
            </>
          ) : (
            <>
              <div className="flex justify-end">
                <button
                  onClick={loadInsights}
                  className="px-3 py-1.5 rounded-lg text-xs font-medium border border-border dark:border-neutral-700 text-text-secondary dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors cursor-pointer"
                >
                  {t("insights.refresh")}
                </button>
              </div>

              {/* KPI */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="bg-white dark:bg-neutral-900 rounded-2xl border border-border dark:border-neutral-800 shadow-card p-5">
                  <div className="flex items-center gap-2 mb-3">
                    <span className="size-8 rounded-lg bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center">
                      <svg className="size-4 text-emerald-600 dark:text-emerald-400" viewBox="0 0 20 20" fill="none"><path d="M5 10l4 4 6-8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
                    </span>
                    <span className="text-xs font-medium text-text-secondary dark:text-neutral-400">{t("insights.qualityScore")}</span>
                  </div>
                  <p className="text-3xl font-bold text-primary dark:text-white">
                    {insights.qualityScore}<span className="text-lg text-text-secondary dark:text-neutral-400">/100</span>
                  </p>
                </div>

                <div className="bg-white dark:bg-neutral-900 rounded-2xl border border-border dark:border-neutral-800 shadow-card p-5">
                  <div className="flex items-center gap-2 mb-3">
                    <span className="size-8 rounded-lg bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
                      <svg className="size-4 text-red-600 dark:text-red-400" viewBox="0 0 20 20" fill="none"><path d="M10 6v4M10 14h.01" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /><circle cx="10" cy="10" r="8" stroke="currentColor" strokeWidth="1.5" /></svg>
                    </span>
                    <span className="text-xs font-medium text-text-secondary dark:text-neutral-400">{t("insights.anomalies")}</span>
                  </div>
                  <p className="text-3xl font-bold text-red-600 dark:text-red-400">{insights.anomalies}</p>
                </div>

                <div className="bg-white dark:bg-neutral-900 rounded-2xl border border-border dark:border-neutral-800 shadow-card p-5">
                  <div className="flex items-center gap-2 mb-3">
                    <span className="size-8 rounded-lg bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center">
                      <svg className="size-4 text-amber-600 dark:text-amber-400" viewBox="0 0 20 20" fill="none"><path d="M4 16h12M6 12h8M8 8h4M10 4v0" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" /></svg>
                    </span>
                    <span className="text-xs font-medium text-text-secondary dark:text-neutral-400">{t("insights.noDescription")}</span>
                  </div>
                  <p className="text-3xl font-bold text-amber-600 dark:text-amber-400">{insights.itemsWithoutDescription}</p>
                </div>

                <div className="bg-white dark:bg-neutral-900 rounded-2xl border border-border dark:border-neutral-800 shadow-card p-5">
                  <div className="flex items-center gap-2 mb-3">
                    <span className="size-8 rounded-lg bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
                      <svg className="size-4 text-blue-600 dark:text-blue-400" viewBox="0 0 20 20" fill="none"><path d="M10 2l1.5 4.5L16 8l-4.5 1.5L10 14l-1.5-4.5L4 8l4.5-1.5L10 2z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" /></svg>
                    </span>
                    <span className="text-xs font-medium text-text-secondary dark:text-neutral-400">{t("insights.suggestions")}</span>
                  </div>
                  <p className="text-3xl font-bold text-blue-600 dark:text-blue-400">{insights.suggestions}</p>
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Détail du score */}
                <div className="bg-white dark:bg-neutral-900 rounded-2xl border border-border dark:border-neutral-800 shadow-card p-6">
                  <h2 className="text-sm font-semibold text-primary dark:text-white mb-4">{t("insights.breakdown")}</h2>
                  {insights.penalties.length === 0 ? (
                    <p className="text-sm text-text-secondary dark:text-neutral-400">{t("insights.noPenalty")}</p>
                  ) : (
                    <ul className="space-y-2">
                      {insights.penalties.map((p) => (
                        <li key={p.label} className="flex items-center justify-between text-sm">
                          <span className="text-text-secondary dark:text-neutral-400">{p.label}</span>
                          <span className="font-semibold text-red-600 dark:text-red-400">−{p.points}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>

                {/* Instantané du référentiel */}
                <div className="bg-white dark:bg-neutral-900 rounded-2xl border border-border dark:border-neutral-800 shadow-card p-6">
                  <h2 className="text-sm font-semibold text-primary dark:text-white mb-4">{t("insights.snapshotTitle")}</h2>
                  <dl className="grid grid-cols-2 gap-x-6 gap-y-2">
                    {SNAPSHOT_ORDER.map((key) => (
                      <div key={key} className="flex items-center justify-between text-sm">
                        <dt className="text-text-secondary dark:text-neutral-400">{t(`insights.snapshot.${key}`)}</dt>
                        <dd className="font-semibold text-primary dark:text-white">{insights.snapshot[key] ?? 0}</dd>
                      </div>
                    ))}
                  </dl>
                </div>
              </div>

              {/* Recommandations */}
              <div className="bg-white dark:bg-neutral-900 rounded-2xl border border-border dark:border-neutral-800 shadow-card">
                <div className="px-6 py-4 border-b border-border dark:border-neutral-800">
                  <h2 className="text-lg font-semibold text-primary dark:text-white">{t("insights.recommendations")}</h2>
                  <p className="text-xs text-text-secondary dark:text-neutral-400 mt-0.5">{t("poweredBy")}</p>
                </div>

                {insights.recommendations.length === 0 ? (
                  <p className="px-6 py-8 text-center text-sm text-text-secondary dark:text-neutral-400">
                    {t("insights.noIssues")}
                  </p>
                ) : (
                  <div className="divide-y divide-border dark:divide-neutral-800">
                    {insights.recommendations.map((rec) => (
                      <div key={rec.code} className="px-6 py-4 flex items-start gap-4">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1 flex-wrap">
                            <h3 className="text-sm font-semibold text-primary dark:text-white">{rec.title}</h3>
                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase ${PRIORITY_STYLES[rec.priority]}`}>
                              {t(`insights.priority.${PRIORITY_KEYS[rec.priority]}`)}
                            </span>
                          </div>
                          <p className="text-xs text-text-secondary dark:text-neutral-400 leading-relaxed">{rec.detail}</p>
                        </div>
                        <span className="shrink-0 text-xs text-text-secondary dark:text-neutral-400 whitespace-nowrap">
                          {rec.impact} {t("insights.affected")}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
