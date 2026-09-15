"use client";

import { useState, useRef, useEffect } from "react";
import { queryIndex, synthesizeSpeech } from "@/lib/api";
import type { QueryResponse } from "@/lib/types";

function formatTime(s: number): string {
  if (!s || s <= 0) return "0:00";
  return `${Math.floor(s / 60)}:${Math.floor(s % 60).toString().padStart(2, "0")}`;
}
function formatAnswer(t: string) {
  return t.replace(/\*\*(.*?)\*\*/g, "<strong class='text-accent'>$1</strong>").replace(/\n/g, "<br>");
}
function scoreColor(s: number) {
  if (s >= 0.8) return { bar: "from-accent to-emerald-300", text: "text-accent", bg: "bg-accent/8" };
  if (s >= 0.6) return { bar: "from-yellow to-amber-300", text: "text-yellow", bg: "bg-yellow/8" };
  return { bar: "from-red to-rose-300", text: "text-red", bg: "bg-red/8" };
}
const CONF: Record<string, { color: string; icon: string }> = {
  high: { color: "bg-accent/12 text-accent border border-accent/20", icon: "◆" },
  medium: { color: "bg-yellow-dim text-yellow border border-yellow/20", icon: "◇" },
  low: { color: "bg-red-dim text-red border border-red/20", icon: "○" },
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
  return <span className="font-mono animate-count-up">{d.toFixed(1)}ms</span>;
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
      <div className="px-5 py-3 border-b border-border glass flex items-center gap-2.5">
        <div className="w-6 h-6 rounded-lg bg-cyan-dim flex items-center justify-center">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="text-cyan">
            <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
          </svg>
        </div>
        <span className="text-xs font-bold uppercase tracking-[0.15em] text-dim">Query Engine</span>
      </div>

      {/* Search bar */}
      <div className="flex gap-2 px-4 py-3 border-b border-border">
        <input
          className="flex-1 glass rounded-xl px-4 py-2.5 text-sm text-foreground focus:outline-none focus:border-cyan/25 focus:shadow-[0_0_16px_rgba(56,189,248,0.06)] transition-all"
          placeholder="Ask anything about the conversation..."
          value={q} onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleQuery()}
        />
        <button onClick={handleQuery} disabled={loading || !q.trim()}
          className="px-5 py-2.5 rounded-xl text-sm font-bold btn-glow-cyan cursor-pointer disabled:cursor-not-allowed whitespace-nowrap">
          Search
        </button>
      </div>

      {/* LLM toggle */}
      <div className="flex items-center gap-3 px-5 py-2 border-b border-border">
        <button onClick={() => setUseLLM(!useLLM)}
          className={`relative w-10 h-[22px] rounded-full cursor-pointer transition-all duration-300 ${
            useLLM ? "bg-accent shadow-[0_0_12px_rgba(52,211,153,0.25)]" : "glass border border-border"
          }`}>
          <div className={`absolute top-[3px] left-[3px] w-4 h-4 rounded-full bg-white transition-all duration-300 shadow-sm ${useLLM ? "translate-x-[18px]" : ""}`} />
        </button>
        <span className="text-xs text-dim">AI Summary</span>
        <span className="text-[10px] text-dim/40 font-mono">~0.5s</span>
      </div>

      {/* Results */}
      <div className="flex-1 overflow-y-auto px-4 py-4">
        {loading && (
          <div className="space-y-3 animate-fade-in">
            <div className="skeleton h-9 w-36" />
            <div className="skeleton h-24 w-full" />
            <div className="skeleton h-18 w-full" />
            <div className="skeleton h-18 w-full" />
          </div>
        )}

        {!loading && !result && (
          <div className="text-center mt-14 animate-fade-in">
            <div className="w-14 h-14 mx-auto mb-4 rounded-2xl glass-glow flex items-center justify-center animate-float" style={{ animationDelay: "0.5s" }}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-cyan">
                <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
              </svg>
            </div>
            <p className="text-sm text-dim">Query the indexed conversation</p>
            <p className="text-[11px] text-dim/40 mt-1 font-mono">&lt;10ms semantic retrieval</p>
          </div>
        )}

        {!loading && result && (
          <div className="space-y-4 animate-slide-up">
            {/* Metrics */}
            <div className="flex flex-wrap items-center gap-2">
              <div className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold ${
                result.retrieval_ms < 10 ? "bg-accent/12 text-accent border border-accent/20 animate-pulse-green" : "glass text-dim"
              }`}>
                ⚡ <AnimatedMs value={result.retrieval_ms} />
              </div>
              {result.generation_ms && (
                <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full glass text-xs text-dim font-mono">
                  🤖 {result.generation_ms.toFixed(0)}ms
                </div>
              )}
              {result.confidence && CONF[result.confidence] && (
                <div className={`inline-flex items-center gap-1 px-2.5 py-1.5 rounded-full text-[11px] font-semibold ${CONF[result.confidence].color}`}>
                  {CONF[result.confidence].icon} {result.confidence}
                </div>
              )}
            </div>

            {/* AI answer */}
            {result.answer && (
              <div className="glass-glow rounded-2xl rounded-tl-sm p-4 border-l-3 border-accent shadow-[0_0_40px_rgba(52,211,153,0.06)] animate-fade-in-up">
                <div className="flex items-start gap-3">
                  <div className="shrink-0 w-7 h-7 rounded-full bg-gradient-to-br from-accent to-emerald-300 flex items-center justify-center text-[9px] font-black text-[#060b18]">AI</div>
                  <div className="flex-1 min-w-0 text-[13px] leading-relaxed" dangerouslySetInnerHTML={{ __html: formatAnswer(result.answer) }} />
                  <button onClick={() => handleSpeak(result.answer!)}
                    className={`shrink-0 w-8 h-8 flex items-center justify-center rounded-full cursor-pointer transition-all duration-300 ${
                      speaking ? "bg-accent text-[#060b18] scale-110 shadow-[0_0_16px_rgba(52,211,153,0.3)]" : "glass text-dim hover:text-accent hover:border-accent/20"
                    }`}>
                    {speaking ? (
                      <div className="flex items-end gap-[2px] h-4">
                        <span className="wave-bar" /><span className="wave-bar" /><span className="wave-bar" /><span className="wave-bar" /><span className="wave-bar" />
                      </div>
                    ) : (
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z"/>
                      </svg>
                    )}
                  </button>
                </div>
              </div>
            )}

            {result.answer && result.passages.length > 0 && (
              <div className="text-[10px] uppercase tracking-[0.15em] text-dim font-bold px-1">Source Signals</div>
            )}

            {result.passages.length > 0 ? (
              <div className="space-y-2">
                {result.passages.map((p, i) => {
                  const sc = scoreColor(p.score);
                  return (
                    <div key={p.id} className="glass-strong rounded-xl overflow-hidden animate-fade-in-up hover:border-border-bright transition-all" style={{ animationDelay: `${i * 70}ms` }}>
                      <div className="flex">
                        <div className={`w-1.5 shrink-0 bg-gradient-to-b ${sc.bar}`} />
                        <div className="flex-1 px-4 py-3">
                          <div className="flex items-center justify-between mb-1.5">
                            <div className="flex items-center gap-2">
                              <span className={`text-xs font-bold font-mono ${sc.text}`}>{(p.score * 100).toFixed(0)}%</span>
                              <span className="text-[10px] text-dim uppercase tracking-wider">{p.speaker}</span>
                            </div>
                            <span className="text-[9px] text-dim font-mono">{formatTime(p.timestamp)}</span>
                          </div>
                          <p className="text-[13px] leading-relaxed text-foreground/85">{p.text}</p>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="text-center py-8 text-dim text-sm">No signals detected.</div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
