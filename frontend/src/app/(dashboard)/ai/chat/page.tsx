"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import api from "@/lib/api";
import toast from "react-hot-toast";
import { useTranslations } from "next-intl";

interface SpeechRecognitionResult {
  readonly length: number;
  item(index: number): SpeechRecognitionAlternative;
  [index: number]: SpeechRecognitionAlternative;
}

interface SpeechRecognitionAlternative {
  readonly transcript: string;
  readonly confidence: number;
}

interface SpeechRecognitionResultList {
  readonly length: number;
  item(index: number): SpeechRecognitionResult;
  [index: number]: SpeechRecognitionResult;
}

interface SpeechRecognitionEvent extends Event {
  readonly results: SpeechRecognitionResultList;
}

interface SpeechRecognitionInstance extends EventTarget {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onresult: ((event: SpeechRecognitionEvent) => void) | null;
  onerror: ((event: Event) => void) | null;
  onend: (() => void) | null;
  start(): void;
  stop(): void;
  abort(): void;
}

type SpeechRecognitionConstructor = new () => SpeechRecognitionInstance;

declare global {
  interface Window {
    SpeechRecognition: SpeechRecognitionConstructor;
    webkitSpeechRecognition: SpeechRecognitionConstructor;
  }
}

interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  createdAt: string;
}

function SendIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 20 20" fill="none">
      <path d="M3 10l14-7-4 7 4 7L3 10z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
      <path d="M7 10h10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

function MicIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 20 20" fill="none">
      <rect x="7" y="2" width="6" height="10" rx="3" stroke="currentColor" strokeWidth="1.5" />
      <path d="M4 10a6 6 0 0012 0" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <path d="M10 16v2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

function SpeakerIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 20 20" fill="none">
      <path d="M3 8v4h3l4 4V4L6 8H3z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" />
      <path d="M13 7a4 4 0 010 6M15 5a7 7 0 010 10" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
    </svg>
  );
}

function StopIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 20 20" fill="none">
      <rect x="4" y="4" width="12" height="12" rx="2" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  );
}

function SparkleIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 20 20" fill="none">
      <path d="M10 2l1.5 4.5L16 8l-4.5 1.5L10 14l-1.5-4.5L4 8l4.5-1.5L10 2z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
      <path d="M15 12l.75 2.25L18 15l-2.25.75L15 18l-.75-2.25L12 15l2.25-.75L15 12z" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round" />
    </svg>
  );
}

function BackIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 20 20" fill="none">
      <path d="M12 4l-6 6 6 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function formatContent(text: string) {
  const parts: React.ReactNode[] = [];
  const lines = text.split("\n");

  lines.forEach((line, lineIdx) => {
    if (lineIdx > 0) parts.push(<br key={`br-${lineIdx}`} />);

    const segments = line.split(/(`[^`]+`|\*\*[^*]+\*\*)/g);
    segments.forEach((seg, segIdx) => {
      const key = `${lineIdx}-${segIdx}`;
      if (seg.startsWith("**") && seg.endsWith("**")) {
        parts.push(<strong key={key} className="font-semibold">{seg.slice(2, -2)}</strong>);
      } else if (seg.startsWith("`") && seg.endsWith("`")) {
        parts.push(
          <code key={key} className="px-1 py-0.5 rounded bg-black/[0.06] dark:bg-white/[0.08] text-[12px] font-mono">
            {seg.slice(1, -1)}
          </code>
        );
      } else {
        parts.push(seg);
      }
    });
  });

  return parts;
}

export default function AiChatPage() {
  const t = useTranslations("aiChat");
  const router = useRouter();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [isListening, setIsListening] = useState(false);
  const [speakingId, setSpeakingId] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null);

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, loading, scrollToBottom]);

  useEffect(() => {
    const loadHistory = async () => {
      try {
        const { data } = await api.get("/ai/chat/history");
        const list = Array.isArray(data) ? data : (data.content ?? []);
        setMessages(list);
      } catch {
        /* no history yet */
      } finally {
        setHistoryLoading(false);
      }
    };
    loadHistory();
  }, []);

  const handleSend = async () => {
    const text = input.trim();
    if (!text || loading) return;

    const userMsg: ChatMessage = {
      id: `temp-${Date.now()}`,
      role: "user",
      content: text,
      createdAt: new Date().toISOString(),
    };
    setMessages(prev => [...prev, userMsg]);
    setInput("");
    setLoading(true);

    try {
      const { data } = await api.post("/ai/chat", { message: text });
      const assistantMsg: ChatMessage = {
        id: data.id ?? `resp-${Date.now()}`,
        role: "assistant",
        content: data.content ?? data.response ?? data.message ?? "",
        createdAt: data.createdAt ?? new Date().toISOString(),
      };
      setMessages(prev => [...prev, assistantMsg]);
    } catch {
      toast.error(t("errorSend"));
      setMessages(prev => prev.filter(m => m.id !== userMsg.id));
      setInput(text);
    } finally {
      setLoading(false);
      inputRef.current?.focus();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleNewConversation = async () => {
    if (!confirm(t("clearConfirm"))) return;
    try {
      await api.delete("/ai/chat/history");
    } catch { /* ignore */ }
    setMessages([]);
    window.speechSynthesis?.cancel();
    setSpeakingId(null);
  };

  const startListening = () => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) {
      toast.error(t("micUnsupported"));
      return;
    }
    const recognition = new SR();
    recognition.lang = "fr-FR";
    recognition.continuous = false;
    recognition.interimResults = false;

    recognition.onresult = (event) => {
      const transcript = event.results[0][0].transcript;
      setInput(prev => (prev ? prev + " " : "") + transcript);
      inputRef.current?.focus();
    };
    recognition.onerror = () => setIsListening(false);
    recognition.onend = () => setIsListening(false);

    setIsListening(true);
    recognition.start();
    recognitionRef.current = recognition;
  };

  const stopListening = () => {
    recognitionRef.current?.stop();
    setIsListening(false);
  };

  const speak = (text: string, messageId: string) => {
    if (!window.speechSynthesis) return;
    if (speakingId === messageId) {
      window.speechSynthesis.cancel();
      setSpeakingId(null);
      return;
    }
    window.speechSynthesis.cancel();
    const clean = text.replace(/\*\*/g, "").replace(/`/g, "");
    const utterance = new SpeechSynthesisUtterance(clean);
    utterance.lang = "fr-FR";
    utterance.rate = 1;
    utterance.onend = () => setSpeakingId(null);
    utterance.onerror = () => setSpeakingId(null);
    setSpeakingId(messageId);
    window.speechSynthesis.speak(utterance);
  };

  return (
    <div className="flex flex-col h-[calc(100dvh-theme(spacing.16)-theme(spacing.12))] max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between pb-4 shrink-0">
        <div className="flex items-center gap-3">
          <button
            onClick={() => router.push("/ai")}
            className="size-8 rounded-lg flex items-center justify-center hover:bg-neutral-100 dark:hover:bg-white/[0.06] transition-colors"
          >
            <BackIcon className="size-4 text-neutral-500" />
          </button>
          <div className="size-9 rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center text-white shadow-lg shadow-violet-500/20">
            <SparkleIcon className="size-[18px]" />
          </div>
          <div>
            <h1 className="text-[15px] font-semibold text-neutral-900 dark:text-white">{t("title")}</h1>
            <p className="text-[11px] text-neutral-400 dark:text-neutral-500">{t("subtitle")}</p>
          </div>
        </div>

        {messages.length > 0 && (
          <button
            onClick={handleNewConversation}
            className="flex items-center gap-1.5 h-8 px-3 rounded-lg text-[12px] font-medium text-neutral-500 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-white/[0.06] transition-colors"
          >
            <svg className="size-3.5" viewBox="0 0 20 20" fill="none">
              <path d="M4 10a6 6 0 1111.3-2.8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              <path d="M15 3v4.2h-4.2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            {t("newConversation")}
          </button>
        )}
      </div>

      {/* Messages area */}
      <div className="flex-1 overflow-y-auto hide-scrollbar rounded-xl bg-neutral-50/50 dark:bg-white/[0.02] ring-1 ring-neutral-200/60 dark:ring-white/[0.06]">
        {historyLoading ? (
          <div className="flex items-center justify-center h-full">
            <div className="size-5 rounded-full border-2 border-violet-500 border-t-transparent animate-spin" />
          </div>
        ) : messages.length === 0 && !loading ? (
          <div className="flex flex-col items-center justify-center h-full px-6 text-center">
            <div className="size-14 rounded-2xl bg-gradient-to-br from-violet-500/10 to-purple-500/10 dark:from-violet-500/20 dark:to-purple-500/20 flex items-center justify-center mb-4">
              <SparkleIcon className="size-7 text-violet-500" />
            </div>
            <h2 className="text-[15px] font-semibold text-neutral-900 dark:text-white mb-1.5">{t("emptyTitle")}</h2>
            <p className="text-[13px] text-neutral-500 dark:text-neutral-400 max-w-sm leading-relaxed">{t("emptySubtitle")}</p>

            <div className="grid grid-cols-2 gap-2.5 mt-6 max-w-md w-full">
              {[
                { q: "Comment optimiser le prix de mes offres ?", icon: "💡" },
                { q: "Analyse le marche telecom au Burkina Faso", icon: "📊" },
                { q: "Quelle strategie marketing pour le segment jeune ?", icon: "🎯" },
                { q: "Compare mes offres avec la concurrence", icon: "⚡" },
              ].map((suggestion) => (
                <button
                  key={suggestion.q}
                  onClick={() => { setInput(suggestion.q); inputRef.current?.focus(); }}
                  className="text-left p-3 rounded-xl bg-white dark:bg-white/[0.04] ring-1 ring-neutral-200/60 dark:ring-white/[0.06] hover:ring-violet-300 dark:hover:ring-violet-500/30 transition-all group"
                >
                  <span className="text-sm mb-1.5 block">{suggestion.icon}</span>
                  <span className="text-[12px] text-neutral-600 dark:text-neutral-400 leading-relaxed group-hover:text-neutral-900 dark:group-hover:text-neutral-200 transition-colors">
                    {suggestion.q}
                  </span>
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-4 p-4">
            {messages.map((msg) => (
              <div
                key={msg.id}
                className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
              >
                <div className={`relative max-w-[80%] group ${msg.role === "user" ? "" : ""}`}>
                  {msg.role === "assistant" && (
                    <div className="flex items-center gap-2 mb-1.5">
                      <div className="size-5 rounded-md bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center">
                        <SparkleIcon className="size-3 text-white" />
                      </div>
                      <span className="text-[10px] font-medium text-neutral-400 dark:text-neutral-500">Moov IA</span>
                    </div>
                  )}
                  <div
                    className={`rounded-2xl px-4 py-2.5 text-[13px] leading-relaxed ${
                      msg.role === "user"
                        ? "bg-violet-600 text-white rounded-br-md"
                        : "bg-white dark:bg-white/[0.06] text-neutral-700 dark:text-neutral-300 rounded-bl-md ring-1 ring-neutral-200/60 dark:ring-white/[0.06]"
                    }`}
                  >
                    {msg.role === "assistant" ? formatContent(msg.content) : msg.content}
                  </div>

                  {msg.role === "assistant" && (
                    <div className="flex items-center gap-1 mt-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={() => speak(msg.content, msg.id)}
                        className="flex items-center gap-1 h-6 px-2 rounded-md text-[10px] font-medium text-neutral-400 dark:text-neutral-500 hover:bg-neutral-100 dark:hover:bg-white/[0.06] transition-colors"
                        title={speakingId === msg.id ? t("stopAudio") : t("playAudio")}
                      >
                        {speakingId === msg.id ? (
                          <><StopIcon className="size-3" /> {t("stopAudio")}</>
                        ) : (
                          <><SpeakerIcon className="size-3" /> {t("playAudio")}</>
                        )}
                      </button>
                      <button
                        onClick={async () => {
                          try { await navigator.clipboard.writeText(msg.content); toast.success("Copie !"); } catch { /* */ }
                        }}
                        className="flex items-center gap-1 h-6 px-2 rounded-md text-[10px] font-medium text-neutral-400 dark:text-neutral-500 hover:bg-neutral-100 dark:hover:bg-white/[0.06] transition-colors"
                      >
                        <svg className="size-3" viewBox="0 0 20 20" fill="none">
                          <rect x="6" y="6" width="10" height="10" rx="1.5" stroke="currentColor" strokeWidth="1.5" />
                          <path d="M14 6V5a1.5 1.5 0 00-1.5-1.5H5A1.5 1.5 0 003.5 5v7.5A1.5 1.5 0 005 14h1" stroke="currentColor" strokeWidth="1.5" />
                        </svg>
                        Copier
                      </button>
                    </div>
                  )}

                  <div className={`text-[10px] text-neutral-400/60 dark:text-neutral-600 mt-1 ${msg.role === "user" ? "text-right" : ""}`}>
                    {new Date(msg.createdAt).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}
                  </div>
                </div>
              </div>
            ))}

            {loading && (
              <div className="flex justify-start">
                <div className="max-w-[80%]">
                  <div className="flex items-center gap-2 mb-1.5">
                    <div className="size-5 rounded-md bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center">
                      <SparkleIcon className="size-3 text-white" />
                    </div>
                    <span className="text-[10px] font-medium text-neutral-400 dark:text-neutral-500">Moov IA</span>
                  </div>
                  <div className="rounded-2xl rounded-bl-md bg-white dark:bg-white/[0.06] ring-1 ring-neutral-200/60 dark:ring-white/[0.06] px-4 py-3">
                    <div className="flex items-center gap-2">
                      <div className="flex gap-1">
                        <span className="size-2 rounded-full bg-violet-400 animate-bounce [animation-delay:0ms]" />
                        <span className="size-2 rounded-full bg-violet-400 animate-bounce [animation-delay:150ms]" />
                        <span className="size-2 rounded-full bg-violet-400 animate-bounce [animation-delay:300ms]" />
                      </div>
                      <span className="text-[12px] text-neutral-400 dark:text-neutral-500">{t("thinking")}</span>
                    </div>
                  </div>
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      {/* Input area */}
      <div className="shrink-0 pt-3">
        <div className="flex items-end gap-2 bg-white dark:bg-white/[0.04] rounded-xl ring-1 ring-neutral-200/80 dark:ring-white/[0.08] p-2 focus-within:ring-violet-400 dark:focus-within:ring-violet-500/40 transition-all">
          {/* Mic button */}
          <button
            onClick={isListening ? stopListening : startListening}
            className={`shrink-0 size-9 rounded-lg flex items-center justify-center transition-all ${
              isListening
                ? "bg-red-500 text-white"
                : "text-neutral-400 hover:bg-neutral-100 dark:hover:bg-white/[0.06] hover:text-neutral-600 dark:hover:text-neutral-300"
            }`}
            title={t("voiceInput")}
          >
            {isListening ? (
              <div className="relative">
                <MicIcon className="size-4" />
                <span className="absolute -top-0.5 -right-0.5 size-2 rounded-full bg-white animate-pulse" />
              </div>
            ) : (
              <MicIcon className="size-4" />
            )}
          </button>

          {/* Text input */}
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={isListening ? t("recording") : t("placeholder")}
            rows={1}
            className="flex-1 resize-none bg-transparent text-[13px] text-neutral-900 dark:text-white placeholder:text-neutral-400 dark:placeholder:text-neutral-500 outline-none py-1.5 max-h-32 overflow-y-auto"
            style={{ minHeight: "36px" }}
          />

          {/* Send button */}
          <button
            onClick={handleSend}
            disabled={!input.trim() || loading}
            className="shrink-0 size-9 rounded-lg bg-violet-600 text-white flex items-center justify-center hover:bg-violet-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {loading ? (
              <div className="size-4 rounded-full border-2 border-white border-t-transparent animate-spin" />
            ) : (
              <SendIcon className="size-4" />
            )}
          </button>
        </div>

        {isListening && (
          <div className="flex items-center gap-2 mt-2 px-2">
            <span className="size-2 rounded-full bg-red-500 animate-pulse" />
            <span className="text-[11px] text-red-500 font-medium">{t("recording")}</span>
          </div>
        )}
      </div>
    </div>
  );
}
