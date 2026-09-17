"use client";

import { useState, useRef, useEffect } from "react";
import NodeGlobe from "./NodeGlobe";
import { queryIndex, synthesizeSpeech } from "@/lib/api";
import type { QueryResponse } from "@/lib/types";

function formatTime(s: number): string {
  if (!s || s <= 0) return "0:00";
  return `${Math.floor(s / 60)}:${Math.floor(s % 60).toString().padStart(2, "0")}`;
}
function formatAnswer(t: string) {
  return t.replace(/\*\*(.*?)\*\*/g, "<strong class='text-accent'>$1</strong>").replace(/\n/g, "<br>");
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
  const [loading, setLoading] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const [result, setResult] = useState<QueryResponse | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const handleQuery = async () => {
    if (!q.trim()) return;
    setLoading(true); setResult(null);
    try { const d = await queryIndex(q, useLLM); setResult(d); onLatency(d.retrieval_ms); } catch { setResult(null); }
    setLoading(false);
  };

  const handleSpeak = async (text: string) => {
    if (speaking) { audioRef.current?.pause(); setSpeaking(false); return; }
    setSpeaking(true);
    try {
      const buf = await synthesizeSpeech(text);
      const url = URL.createObjectURL(new Blob([buf], { type: "audio/wav" }));
      const a = new Audio(url);
      audioRef.current = a;
      a.onended = () => { setSpeaking(false); URL.revokeObjectURL(url); };
      a.play();
    } catch { setSpeaking(false); }
  };

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-3 px-6 py-3.5 border-b border-border bg-surface">
        <div className="w-7 h-7 rounded-xl bg-cyan-dim flex items-center justify-center">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="text-cyan">
            <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
          </svg>
        </div>
        <span className="text-[11px] font-extrabold uppercase tracking-[0.2em] text-dim">Query Engine</span>
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
          <button onClick={handleQuery} disabled={loading || !q.trim()}
            className="px-6 py-3 rounded-xl text-sm font-extrabold uppercase tracking-[0.08em] transition-all cursor-pointer disabled:opacity-25 disabled:cursor-not-allowed bg-cyan text-[#060b18] hover:shadow-[0_0_30px_rgba(56,189,248,0.2)] active:scale-[0.98]">
            Search
          </button>
        </div>

        {/* Toggle */}
        <div className="flex items-center gap-3">
          <button onClick={() => setUseLLM(!useLLM)}
            className={`relative w-11 h-6 rounded-full cursor-pointer transition-all duration-300 ${
              useLLM ? "bg-accent shadow-[0_0_12px_rgba(52,211,153,0.2)]" : "bg-surface2 border border-border"
            }`}>
            <div className={`absolute top-1 left-1 w-4 h-4 rounded-full bg-white transition-all duration-300 shadow-sm ${useLLM ? "translate-x-5" : ""}`} />
          </button>
          <span className="text-[11px] font-bold uppercase tracking-[0.1em] text-dim">AI Summary</span>
          <span className="text-[10px] text-dim/40 font-mono">~0.5s</span>
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
            {/* Metrics */}
            <div className="flex flex-wrap items-center gap-2">
              <div className={`card flex items-center gap-2 px-4 py-2 text-xs ${
                result.retrieval_ms < 10 ? "border-accent/20 text-accent animate-pulse-green" : "text-dim"
              }`}>
                ⚡ <AnimatedMs value={result.retrieval_ms} />
              </div>
              {result.generation_ms && (
                <div className="card flex items-center gap-2 px-4 py-2 text-xs text-dim font-mono">
                  🤖 {result.generation_ms.toFixed(0)}ms
                </div>
              )}
              {result.confidence && CONF[result.confidence] && (
                <div className={`flex items-center gap-1.5 px-3 py-2 rounded-2xl text-[11px] font-bold ${CONF[result.confidence].cls}`}>
                  {CONF[result.confidence].icon} {result.confidence}
                </div>
              )}
            </div>

            {/* AI answer */}
            {result.answer && (
              <div className="card-glow p-5 animate-fade-in-up">
                <div className="flex items-start gap-4">
                  <div className="shrink-0 w-9 h-9 rounded-xl bg-accent/15 flex items-center justify-center text-[10px] font-black text-accent">AI</div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[10px] uppercase tracking-[0.15em] text-dim font-bold mb-2">AI Summary</p>
                    <div className="text-[14px] leading-[1.8]" dangerouslySetInnerHTML={{ __html: formatAnswer(result.answer) }} />
                  </div>
                  <button onClick={() => handleSpeak(result.answer!)}
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
                </div>
              </div>
            )}

            {/* Source passages */}
            {result.answer && result.passages.length > 0 && (
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
