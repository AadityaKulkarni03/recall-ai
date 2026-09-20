"use client";

import { useState, useRef, useEffect, Fragment, useCallback } from "react";
import NodeGlobe from "./NodeGlobe";
import { queryIndex, queryStream, streamSummarize, synthesizeSpeech } from "@/lib/api";
import type { QueryResponse, Passage } from "@/lib/types";

function formatTime(s: number): string {
  if (!s || s <= 0) return "0:00";
  return `${Math.floor(s / 60)}:${Math.floor(s % 60).toString().padStart(2, "0")}`;
}

/** Safely render markdown-style **bold** and newlines as React elements. */
function FormattedAnswer({ text }: { text: string }) {
  const lines = text.split("\n");
  return (
    <>
      {lines.map((line, li) => (
        <Fragment key={li}>
          {li > 0 && <br />}
          {line.split(/\*\*(.*?)\*\*/g).map((part, pi) =>
            pi % 2 === 1 ? (
              <strong key={pi} className="text-accent">{part}</strong>
            ) : (
              <Fragment key={pi}>{part}</Fragment>
            )
          )}
        </Fragment>
      ))}
    </>
  );
}
function scoreStyle(s: number) {
  if (s >= 0.8) return { bar: "bg-accent", text: "text-accent", label: "bg-accent/10 text-accent" };
  if (s >= 0.6) return { bar: "bg-yellow", text: "text-yellow", label: "bg-yellow-dim text-yellow" };
  return { bar: "bg-red", text: "text-red", label: "bg-red-dim text-red" };
}
const CONF: Record<string, { cls: string; icon: string }> = {
  high: { cls: "bg-accent/10 text-accent border border-accent/15", icon: "◆" },
  medium: { cls: "bg-yellow-dim text-yellow border border-yellow/15", icon: "◇" },
  low: { cls: "bg-red-dim text-red border border-red/15", icon: "○" },
};

function AnimatedMs({ value }: { value: number }) {
  const [d, setD] = useState(0);
  useEffect(() => {
    const start = performance.now();
    const tick = () => {
      const p = Math.min((performance.now() - start) / 500, 1);
      setD(value * p);
      if (p < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }, [value]);
  return <span className="font-mono font-extrabold animate-count-up">{d.toFixed(1)}ms</span>;
}

interface QueryPanelProps { onLatency: (ms: number) => void; }

export default function QueryPanel({ onLatency }: QueryPanelProps) {
  const [q, setQ] = useState("");
  const [useLLM, setUseLLM] = useState(false);
  const useLLMRef = useRef(false);
  const [loading, setLoading] = useState(false);
  const [streaming, setStreaming] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const [result, setResult] = useState<QueryResponse | null>(null);
  const [streamAnswer, setStreamAnswer] = useState("");
  const [streamGenMs, setStreamGenMs] = useState<number | null>(null);
  const streamStartRef = useRef(0);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const ttsCacheRef = useRef<{ text: string; url: string } | null>(null);
  const ttsLoadingRef = useRef(false);

  // Prefetch TTS in background — does not block anything
  const prefetchTTS = useCallback((text: string) => {
    const clean = text
      .replace(/^Answer:\s*/i, "")
      .replace(/\nConfidence:\s*(high|medium|low)\s*$/i, "")
      .replace(/\n?Sources?:[\s\S]*$/i, "")
      .replace(/\s*\([\w\s]+@\s*[\d?]+s?\)/g, "")
      .replace(/\s*\([\w\s]+,\s*[\d?]+s?\)/g, "")
      .replace(/\s*\[\d+\]/g, "")
      .trim();
    if (!clean || ttsLoadingRef.current) return;
    ttsLoadingRef.current = true;
    synthesizeSpeech(clean)
      .then((buf) => {
        const url = URL.createObjectURL(new Blob([buf], { type: "audio/wav" }));
        ttsCacheRef.current = { text: clean, url };
      })
      .catch(() => {})
      .finally(() => { ttsLoadingRef.current = false; });
  }, []);

  const streamAnswerRef = useRef("");

  const toggleLLM = () => {
    const next = !useLLMRef.current;
    useLLMRef.current = next;
    setUseLLM(next);
  };

  const handleQuery = useCallback(async () => {
    if (!q.trim()) return;
    const wantLLM = useLLMRef.current;

    setLoading(true);
    setResult(null);
    setStreamAnswer("");
    setStreamGenMs(null);
    setStreaming(false);
    // Invalidate TTS cache on new query
    if (ttsCacheRef.current) { URL.revokeObjectURL(ttsCacheRef.current.url); ttsCacheRef.current = null; }
    streamAnswerRef.current = "";

    if (!wantLLM) {
      // Non-streaming: retrieval only
      try {
        const d = await queryIndex(q, false);
        setResult(d);
        onLatency(d.retrieval_ms);
      } catch { setResult(null); }
      setLoading(false);
      return;
    }

    // Streaming: retrieval + LLM tokens
    try {
      await queryStream(
        q,
        true,
        5,
        (data) => {
          // Retrieval results arrived
          setResult({
            query: q,
            retrieval_ms: data.retrieval_ms,
            passages: data.passages,
            answer: null,
            generation_ms: null,
            model: null,
            confidence: null,
          });
          onLatency(data.retrieval_ms);
          setLoading(false);
          setStreaming(true);
          streamStartRef.current = performance.now();
        },
        (token) => {
          // LLM token arrived
          streamAnswerRef.current += token;
          setStreamAnswer((prev) => prev + token);
        },
        () => {
          // Stream done — calculate generation time and prefetch TTS
          const genMs = Math.round(performance.now() - streamStartRef.current);
          setStreamGenMs(genMs);
          setStreaming(false);
          if (streamAnswerRef.current) prefetchTTS(streamAnswerRef.current);
        },
      );
    } catch {
      setResult(null);
      setLoading(false);
      setStreaming(false);
    }
  }, [q, onLatency]);

  // When streaming is done, fold the streamed answer into the result
  const rawAnswer = result?.answer || streamAnswer || null;
  // Strip "Answer:" prefix, "Confidence: ..." suffix, and "Sources: ..." lines from output
  const displayAnswer = rawAnswer
    ? rawAnswer
        .replace(/^Answer:\s*/i, "")
        .replace(/\nConfidence:\s*(high|medium|low)\s*$/i, "")
        .replace(/\n?Sources?:[\s\S]*$/i, "")
        .replace(/\s*\([\w\s]+@\s*[\d?]+s?\)/g, "")
        .replace(/\s*\([\w\s]+,\s*[\d?]+s?\)/g, "")
        .replace(/\s*\[\d+\]/g, "")
        .trim()
    : null;
  const displayGenMs = result?.generation_ms ?? streamGenMs;

  const handleSpeak = async (text: string) => {
    if (speaking) { audioRef.current?.pause(); setSpeaking(false); return; }
    setSpeaking(true);
    try {
      let url: string;
      // Use prefetched audio if available and matches
      const clean = text
        .replace(/^Answer:\s*/i, "")
        .replace(/\nConfidence:\s*(high|medium|low)\s*$/i, "")
        .replace(/\n?Sources?:[\s\S]*$/i, "")
        .replace(/\s*\([\w\s]+@\s*[\d?]+s?\)/g, "")
        .replace(/\s*\([\w\s]+,\s*[\d?]+s?\)/g, "")
        .replace(/\s*\[\d+\]/g, "")
        .trim();
      if (ttsCacheRef.current && ttsCacheRef.current.text === clean) {
        url = ttsCacheRef.current.url;
      } else {
        const buf = await synthesizeSpeech(clean);
        url = URL.createObjectURL(new Blob([buf], { type: "audio/wav" }));
      }
      const a = new Audio(url);
      audioRef.current = a;
      a.onended = () => { setSpeaking(false); };
      a.play();
    } catch { setSpeaking(false); }
  };

  const handleSummarize = useCallback(async () => {
    setLoading(true);
    setResult({ query: "Meeting Summary", retrieval_ms: 0, passages: [], answer: null, generation_ms: null, model: null, confidence: null });
    setStreamAnswer("");
    setStreamGenMs(null);
    setStreaming(false);
    streamAnswerRef.current = "";
    if (ttsCacheRef.current) { URL.revokeObjectURL(ttsCacheRef.current.url); ttsCacheRef.current = null; }

    try {
      const startTime = performance.now();
      setLoading(false);
      setStreaming(true);
      await streamSummarize(
        (token) => {
          streamAnswerRef.current += token;
          setStreamAnswer((prev) => prev + token);
        },
        () => {
          setStreamGenMs(Math.round(performance.now() - startTime));
          setStreaming(false);
          if (streamAnswerRef.current) prefetchTTS(streamAnswerRef.current);
        },
      );
    } catch {
      setLoading(false);
      setStreaming(false);
    }
  }, []);

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-3.5 border-b border-border bg-surface">
        <div className="flex items-center gap-3">
          <div className="w-7 h-7 rounded-xl bg-cyan-dim flex items-center justify-center">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="text-cyan">
              <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
            </svg>
          </div>
          <span className="text-[11px] font-extrabold uppercase tracking-[0.2em] text-dim">Query Engine</span>
        </div>
        <button
          onClick={handleSummarize}
          disabled={loading || streaming}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[10px] font-bold uppercase tracking-[0.1em] text-accent bg-accent/10 border border-accent/15 hover:bg-accent/20 transition-all cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
            <polyline points="14 2 14 8 20 8" />
            <line x1="16" y1="13" x2="8" y2="13" />
            <line x1="16" y1="17" x2="8" y2="17" />
          </svg>
          Summarize
        </button>
      </div>

      {/* Search */}
      <div className="px-6 py-4 border-b border-border space-y-3">
        <div className="flex gap-2">
          <input
            className="flex-1 bg-surface border border-border rounded-xl px-4 py-3 text-sm text-foreground placeholder:text-dim/50 focus:outline-none focus:border-cyan/20 focus:shadow-[0_0_20px_rgba(56,189,248,0.04)] transition-all"
            placeholder="Ask anything about the conversation..."
            value={q} onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleQuery()}
          />
          <button onClick={handleQuery} disabled={loading || streaming || !q.trim()}
            className="px-6 py-3 rounded-xl text-sm font-extrabold uppercase tracking-[0.08em] transition-all cursor-pointer disabled:opacity-25 disabled:cursor-not-allowed bg-cyan text-[#060b18] hover:shadow-[0_0_30px_rgba(56,189,248,0.2)] active:scale-[0.98]">
            Search
          </button>
        </div>

        {/* Toggle */}
        <div className="flex items-center gap-3">
          <button onClick={toggleLLM}
            className={`relative w-11 h-6 rounded-full cursor-pointer transition-all duration-300 ${
              useLLM ? "bg-accent shadow-[0_0_12px_rgba(52,211,153,0.2)]" : "bg-surface2 border border-border"
            }`}>
            <div className={`absolute top-1 left-1 w-4 h-4 rounded-full bg-white transition-all duration-300 shadow-sm ${useLLM ? "translate-x-5" : ""}`} />
          </button>
          <span className="text-[11px] font-bold uppercase tracking-[0.1em] text-dim">AI Summary</span>
          {streaming && (
            <span className="text-[10px] text-accent font-mono animate-pulse">streaming...</span>
          )}
        </div>
      </div>

      {/* Results */}
      <div className="flex-1 overflow-y-auto px-6 py-5">
        {loading && (
          <div className="space-y-3 animate-fade-in">
            <div className="skeleton h-10 w-40" />
            <div className="skeleton h-28 w-full" />
            <div className="skeleton h-20 w-full" />
            <div className="skeleton h-20 w-full" />
          </div>
        )}

        {!loading && !result && (
          <div className="text-center mt-10 animate-fade-in">
            <div className="globe-cradle mb-1">
              <NodeGlobe size={200} />
            </div>
            <p className="text-base font-bold text-foreground">Query the conversation</p>
            <p className="text-sm text-dim mt-1">Moss retrieves relevant moments in <span className="text-accent font-mono">&lt;10ms</span></p>
          </div>
        )}

        {!loading && result && (
          <div className="space-y-5 animate-slide-up">
            {/* Latency breakdown */}
            <div className="card p-4 space-y-2.5">
              <p className="text-[10px] font-extrabold uppercase tracking-[0.2em] text-dim">Latency Breakdown</p>
              <div className="flex items-center gap-2 flex-wrap">
                <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[11px] font-mono font-bold ${
                  result.retrieval_ms < 10 ? "bg-accent/10 text-accent border border-accent/15" : "bg-surface2 text-dim border border-border"
                }`}>
                  <span className="text-[10px] opacity-60">⚡ Retrieval</span>
                  <AnimatedMs value={result.retrieval_ms} />
                </div>
                {displayGenMs != null && (
                  <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[11px] font-mono font-bold bg-surface2 text-dim border border-border">
                    <span className="text-[10px] opacity-60">🤖 Generation</span>
                    {displayGenMs.toFixed(0)}ms
                  </div>
                )}
                <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[11px] font-mono font-bold bg-surface2 text-foreground/70 border border-border">
                  <span className="text-[10px] opacity-60">Σ Total</span>
                  {(result.retrieval_ms + (displayGenMs || 0)).toFixed(0)}ms
                </div>
              </div>
              {/* Visual bar */}
              <div className="flex h-2 rounded-full overflow-hidden bg-surface2">
                <div
                  className="bg-accent transition-all duration-500"
                  style={{ width: `${Math.max(2, (result.retrieval_ms / (result.retrieval_ms + (displayGenMs || 1))) * 100)}%` }}
                  title={`Retrieval: ${result.retrieval_ms.toFixed(1)}ms`}
                />
                {displayGenMs != null && (
                  <div
                    className="bg-cyan transition-all duration-500"
                    style={{ width: `${(displayGenMs / (result.retrieval_ms + displayGenMs)) * 100}%` }}
                    title={`Generation: ${displayGenMs.toFixed(0)}ms`}
                  />
                )}
              </div>
              <div className="flex items-center gap-4 text-[9px] text-dim">
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-accent inline-block" /> Retrieval</span>
                {displayGenMs != null && (
                  <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-cyan inline-block" /> Generation</span>
                )}
              </div>
            </div>

            {/* Confidence */}
            <div className="flex flex-wrap items-center gap-2">
              {result.confidence && CONF[result.confidence] && (
                <div className={`flex items-center gap-1.5 px-3 py-2 rounded-2xl text-[11px] font-bold ${CONF[result.confidence].cls}`}>
                  {CONF[result.confidence].icon} {result.confidence}
                </div>
              )}
            </div>

            {/* AI answer (streaming or static) */}
            {displayAnswer && (
              <div className="card-glow p-5 animate-fade-in-up">
                <div className="flex items-start gap-4">
                  <div className="shrink-0 w-9 h-9 rounded-xl bg-accent/15 flex items-center justify-center text-[10px] font-black text-accent">AI</div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[10px] uppercase tracking-[0.15em] text-dim font-bold mb-2">AI Summary</p>
                    <div className="text-[14px] leading-[1.8]">
                      <FormattedAnswer text={displayAnswer} />
                      {streaming && <span className="inline-block w-2 h-4 bg-accent/60 animate-pulse ml-0.5 rounded-sm" />}
                    </div>
                  </div>
                  {!streaming && (
                    <button onClick={() => handleSpeak(displayAnswer)}
                      className={`shrink-0 w-9 h-9 flex items-center justify-center rounded-xl cursor-pointer transition-all duration-300 ${
                        speaking ? "bg-accent text-[#060b18] scale-110 shadow-[0_0_20px_rgba(52,211,153,0.3)]" : "card text-dim hover:text-accent hover:border-accent/20"
                      }`}>
                      {speaking ? (
                        <div className="flex items-end gap-[2px] h-4">
                          <span className="wave-bar"/><span className="wave-bar"/><span className="wave-bar"/><span className="wave-bar"/><span className="wave-bar"/>
                        </div>
                      ) : (
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                          <path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z"/>
                        </svg>
                      )}
                    </button>
                  )}
                </div>
              </div>
            )}

            {/* Source passages */}
            {(displayAnswer || result.passages.length > 0) && result.passages.length > 0 && (
              <p className="text-[10px] font-extrabold uppercase tracking-[0.2em] text-dim px-1">Source Passages</p>
            )}

            {result.passages.length > 0 ? (
              <div className="space-y-2.5">
                {result.passages.map((p, i) => {
                  const sc = scoreStyle(p.score);
                  return (
                    <div key={p.id} className="card overflow-hidden animate-fade-in-up hover:border-border-bright transition-all" style={{ animationDelay: `${i * 70}ms` }}>
                      <div className="flex">
                        <div className={`w-1.5 shrink-0 ${sc.bar}`} />
                        <div className="flex-1 px-5 py-4">
                          <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-3">
                              <span className={`px-2.5 py-1 rounded-lg text-[11px] font-extrabold font-mono ${sc.label}`}>
                                {(p.score * 100).toFixed(0)}%
                              </span>
                              <span className="text-[10px] text-dim uppercase tracking-[0.15em] font-bold">{p.speaker}</span>
                            </div>
                            <span className="text-[10px] text-dim font-mono">{formatTime(p.timestamp)}</span>
                          </div>
                          <p className="text-[13px] leading-[1.7] text-foreground/85">{p.text}</p>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="text-center py-10 text-dim">No matching passages found.</div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
