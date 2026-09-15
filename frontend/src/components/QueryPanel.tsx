"use client";

import { useState, useRef, useEffect } from "react";
import { queryIndex, synthesizeSpeech } from "@/lib/api";
import type { QueryResponse } from "@/lib/types";

function formatTime(seconds: number): string {
  if (!seconds || seconds <= 0) return "0:00";
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function formatAnswer(text: string) {
  return text
    .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")
    .replace(/\n/g, "<br>");
}

function getScoreGradient(score: number): string {
  if (score >= 0.8) return "from-green/60 to-green/20";
  if (score >= 0.6) return "from-yellow/60 to-yellow/20";
  return "from-red/60 to-red/20";
}

const CONFIDENCE_CONFIG: Record<string, { color: string; icon: string }> = {
  high: { color: "bg-green-dim text-green", icon: "✓" },
  medium: { color: "bg-yellow/10 text-yellow", icon: "~" },
  low: { color: "bg-red-dim text-red", icon: "!" },
};

// Animated counter that counts up from 0 to target
function AnimatedMs({ value }: { value: number }) {
  const [display, setDisplay] = useState(0);
  useEffect(() => {
    const start = performance.now();
    const duration = 400;
    const target = value;
    const tick = () => {
      const elapsed = performance.now() - start;
      const progress = Math.min(elapsed / duration, 1);
      setDisplay(target * progress);
      if (progress < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }, [value]);
  return <span className="font-mono animate-count-up">{display.toFixed(1)}ms</span>;
}

interface QueryPanelProps {
  onLatency: (ms: number) => void;
}

export default function QueryPanel({ onLatency }: QueryPanelProps) {
  const [question, setQuestion] = useState("");
  const [useLLM, setUseLLM] = useState(false);
  const [loading, setLoading] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const [result, setResult] = useState<QueryResponse | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const handleQuery = async () => {
    if (!question.trim()) return;
    setLoading(true);
    setResult(null);
    try {
      const data = await queryIndex(question, useLLM);
      setResult(data);
      onLatency(data.retrieval_ms);
    } catch {
      setResult(null);
    }
    setLoading(false);
  };

  const handleSpeak = async (text: string) => {
    if (speaking) {
      audioRef.current?.pause();
      setSpeaking(false);
      return;
    }
    setSpeaking(true);
    try {
      const audioBuffer = await synthesizeSpeech(text);
      const blob = new Blob([audioBuffer], { type: "audio/wav" });
      const url = URL.createObjectURL(blob);
      const audio = new Audio(url);
      audioRef.current = audio;
      audio.onended = () => { setSpeaking(false); URL.revokeObjectURL(url); };
      audio.play();
    } catch {
      setSpeaking(false);
    }
  };

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="px-5 py-3 border-b border-border flex items-center gap-2">
        <div className="w-5 h-5 rounded-md bg-cyan-dim flex items-center justify-center">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="text-cyan">
            <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
          </svg>
        </div>
        <span className="text-sm font-semibold">Ask Anything</span>
      </div>

      {/* Query input */}
      <div className="flex gap-2 px-4 py-3 border-b border-border">
        <input
          className="flex-1 glass rounded-xl px-4 py-2.5 text-sm text-foreground focus:outline-none focus:border-cyan/30 focus:shadow-[0_0_12px_rgba(34,211,238,0.08)] transition-all"
          placeholder="What was discussed about..."
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleQuery()}
        />
        <button
          onClick={handleQuery}
          disabled={loading || !question.trim()}
          className="px-5 py-2.5 rounded-xl font-semibold text-sm whitespace-nowrap transition-all duration-300 cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed bg-gradient-to-r from-cyan to-teal-400 text-black hover:shadow-[0_0_16px_rgba(34,211,238,0.3)] active:scale-[0.98]"
        >
          Search
        </button>
      </div>

      {/* LLM toggle */}
      <div className="flex items-center gap-3 px-5 py-2 text-sm border-b border-border">
        <button
          onClick={() => setUseLLM(!useLLM)}
          className={`relative w-10 h-5.5 rounded-full cursor-pointer transition-all duration-300 ${
            useLLM ? "bg-accent shadow-[0_0_10px_rgba(249,115,22,0.3)]" : "bg-surface2 border border-border"
          }`}
        >
          <div className={`absolute top-0.5 left-0.5 w-4.5 h-4.5 rounded-full bg-white transition-all duration-300 ${
            useLLM ? "translate-x-[18px]" : ""
          }`} />
        </button>
        <span className="text-dim text-xs">AI Summary</span>
        <span className="text-[10px] text-dim/50">Groq LLM ~0.5s</span>
      </div>

      {/* Results area */}
      <div className="flex-1 overflow-y-auto px-4 py-4">
        {/* Loading skeleton */}
        {loading && (
          <div className="space-y-3 animate-fade-in">
            <div className="skeleton h-8 w-32" />
            <div className="skeleton h-20 w-full" />
            <div className="skeleton h-16 w-full" />
            <div className="skeleton h-16 w-full" />
          </div>
        )}

        {/* Empty state */}
        {!loading && !result && (
          <div className="text-center mt-12 animate-fade-in">
            <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-cyan-dim flex items-center justify-center">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-cyan">
                <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
              </svg>
            </div>
            <p className="text-sm text-dim">Ask a question about the conversation</p>
            <p className="text-xs text-dim/50 mt-1">Moss retrieves relevant moments in &lt;10ms</p>
          </div>
        )}

        {/* Results */}
        {!loading && result && (
          <div className="space-y-4 animate-slide-up">
            {/* Metrics bar */}
            <div className="flex flex-wrap items-center gap-2">
              <div className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold ${
                result.retrieval_ms < 10 ? "bg-green-dim text-green" : "bg-surface2 text-dim"
              }`}>
                <span>⚡</span>
                <AnimatedMs value={result.retrieval_ms} />
              </div>
              {result.generation_ms && (
                <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-surface2 text-xs text-dim">
                  🤖 {result.generation_ms.toFixed(0)}ms
                </div>
              )}
              {result.confidence && CONFIDENCE_CONFIG[result.confidence] && (
                <div className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium ${CONFIDENCE_CONFIG[result.confidence].color}`}>
                  <span>{CONFIDENCE_CONFIG[result.confidence].icon}</span>
                  <span>{result.confidence}</span>
                </div>
              )}
            </div>

            {/* LLM answer bubble */}
            {result.answer && (
              <div className="glass-strong rounded-2xl rounded-tl-sm p-4 border-l-3 border-accent shadow-[0_0_30px_rgba(249,115,22,0.08),0_0_8px_rgba(249,115,22,0.12)] animate-fade-in-up">
                <div className="flex items-start gap-3">
                  <div className="shrink-0 w-7 h-7 rounded-full bg-accent/20 flex items-center justify-center text-accent text-xs">
                    AI
                  </div>
                  <div className="flex-1 min-w-0">
                    <div
                      className="text-sm leading-relaxed"
                      dangerouslySetInnerHTML={{ __html: formatAnswer(result.answer) }}
                    />
                  </div>
                  <button
                    onClick={() => handleSpeak(result.answer!)}
                    className={`shrink-0 w-8 h-8 flex items-center justify-center rounded-full cursor-pointer transition-all duration-300 ${
                      speaking
                        ? "bg-accent text-black scale-110"
                        : "bg-surface2 text-dim hover:text-accent hover:bg-accent-dim"
                    }`}
                    title={speaking ? "Stop" : "Listen"}
                  >
                    {speaking ? (
                      <div className="flex items-end gap-[2px] h-4">
                        <span className="wave-bar" />
                        <span className="wave-bar" />
                        <span className="wave-bar" />
                        <span className="wave-bar" />
                        <span className="wave-bar" />
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

            {/* Source passages label */}
            {result.answer && result.passages.length > 0 && (
              <div className="text-[11px] uppercase tracking-wider text-dim font-medium px-1">
                Source passages
              </div>
            )}

            {/* Passage cards */}
            {result.passages.length > 0 ? (
              <div className="space-y-2">
                {result.passages.map((p, i) => (
                  <div
                    key={p.id}
                    className="glass-strong rounded-xl px-4 py-3 animate-fade-in-up hover:border-border-bright transition-colors"
                    style={{ animationDelay: `${i * 80}ms` }}
                  >
                    <div className="flex items-start gap-3">
                      {/* Score gradient bar */}
                      <div className={`shrink-0 w-1.5 self-stretch rounded-full bg-gradient-to-b ${getScoreGradient(p.score)}`} />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between mb-1">
                          <div className="flex items-center gap-2">
                            <span className={`text-xs font-bold ${
                              p.score >= 0.8 ? "text-green" : p.score >= 0.6 ? "text-yellow" : "text-red"
                            }`}>
                              {(p.score * 100).toFixed(0)}%
                            </span>
                            <span className="text-[11px] text-dim">{p.speaker}</span>
                          </div>
                          <span className="text-[10px] text-dim font-mono">{formatTime(p.timestamp)}</span>
                        </div>
                        <p className="text-sm leading-relaxed text-foreground/90">{p.text}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-dim text-sm">No matching passages found.</div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
