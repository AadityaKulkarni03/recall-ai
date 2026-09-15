"use client";

import { useEffect, useRef, useState } from "react";
import type { TranscriptEntry } from "@/lib/types";

function formatTime(seconds: number): string {
  if (!seconds || seconds <= 0) return "0:00";
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function getInitialColor(name: string): string {
  const colors = [
    "bg-accent/20 text-accent",
    "bg-cyan-dim text-cyan",
    "bg-green-dim text-green",
    "bg-purple-500/20 text-purple-400",
    "bg-pink-500/20 text-pink-400",
    "bg-blue-500/20 text-blue-400",
  ];
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return colors[Math.abs(hash) % colors.length];
}

interface TranscriptProps {
  entries: TranscriptEntry[];
  isRecording?: boolean;
}

export default function Transcript({ entries, isRecording }: TranscriptProps) {
  const bottomRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [showScrollBtn, setShowScrollBtn] = useState(false);
  const [autoScroll, setAutoScroll] = useState(true);

  useEffect(() => {
    if (autoScroll) bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [entries.length, autoScroll]);

  const handleScroll = () => {
    const el = containerRef.current;
    if (!el) return;
    const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 60;
    setShowScrollBtn(!atBottom);
    setAutoScroll(atBottom);
  };

  const scrollToBottom = () => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
    setAutoScroll(true);
  };

  return (
    <div className="flex flex-col flex-1 overflow-hidden">
      <div className="flex items-center justify-between px-4 py-2.5 border-t border-b border-border">
        <span className="text-xs font-semibold uppercase tracking-wider text-dim">Transcript</span>
        <span className="text-[11px] text-dim font-mono">
          {entries.length} {entries.length === 1 ? "entry" : "entries"}
        </span>
      </div>

      <div
        ref={containerRef}
        onScroll={handleScroll}
        className="relative flex-1 overflow-y-auto px-4 py-3 space-y-2"
      >
        {entries.length === 0 && !isRecording && (
          <div className="text-center mt-12 animate-fade-in">
            <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-surface2 flex items-center justify-center">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-dim">
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
              </svg>
            </div>
            <p className="text-sm text-dim">No conversation yet</p>
            <p className="text-xs text-dim/60 mt-1">Upload text, audio, or start recording</p>
          </div>
        )}

        {entries.map((entry, i) => {
          const colorClass = getInitialColor(entry.speaker);
          const initial = entry.speaker.charAt(0).toUpperCase();
          return (
            <div
              key={`${entry.id}-${i}`}
              className="flex gap-3 animate-fade-in-up"
              style={{ animationDelay: `${Math.min(i * 30, 200)}ms` }}
            >
              {/* Avatar */}
              <div className={`shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${colorClass}`}>
                {initial}
              </div>
              {/* Bubble */}
              <div className="flex-1 min-w-0">
                <div className="glass-strong rounded-xl rounded-tl-sm px-3 py-2 shadow-[0_1px_4px_rgba(0,0,0,0.2)]">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[11px] font-semibold text-accent">{entry.speaker}</span>
                    <span className="text-[10px] text-dim font-mono">{formatTime(entry.timestamp)}</span>
                  </div>
                  <p className="text-sm leading-relaxed">{entry.text}</p>
                </div>
              </div>
            </div>
          );
        })}

        {/* Typing indicator when recording */}
        {isRecording && (
          <div className="flex gap-3 animate-fade-in">
            <div className="shrink-0 w-7 h-7 rounded-full bg-red-dim flex items-center justify-center">
              <div className="w-2 h-2 rounded-full bg-red animate-pulse" />
            </div>
            <div className="glass-strong rounded-xl rounded-tl-sm px-4 py-3">
              <div className="flex items-center gap-1.5">
                <span className="typing-dot" />
                <span className="typing-dot" />
                <span className="typing-dot" />
              </div>
            </div>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Scroll to bottom button */}
      {showScrollBtn && (
        <button
          onClick={scrollToBottom}
          className="absolute bottom-4 left-1/2 -translate-x-1/2 glass-strong px-3 py-1.5 rounded-full text-xs text-dim hover:text-foreground transition-all animate-slide-up cursor-pointer z-10"
        >
          ↓ Scroll to latest
        </button>
      )}
    </div>
  );
}
