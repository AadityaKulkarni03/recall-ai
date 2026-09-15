"use client";

import { useEffect, useRef, useState } from "react";
import type { TranscriptEntry } from "@/lib/types";

function formatTime(s: number): string {
  if (!s || s <= 0) return "0:00";
  return `${Math.floor(s / 60)}:${Math.floor(s % 60).toString().padStart(2, "0")}`;
}

const COLORS = ["text-accent","text-cyan","text-purple-400","text-pink-400","text-amber-400","text-blue-400"];
const BG_COLORS = ["bg-accent/15","bg-cyan/15","bg-purple-400/15","bg-pink-400/15","bg-amber-400/15","bg-blue-400/15"];

function hash(s: string) { let h = 0; for (let i = 0; i < s.length; i++) h = s.charCodeAt(i) + ((h << 5) - h); return Math.abs(h); }

interface TranscriptProps {
  entries: TranscriptEntry[];
  isRecording?: boolean;
}

export default function Transcript({ entries, isRecording }: TranscriptProps) {
  const bottomRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [showScroll, setShowScroll] = useState(false);
  const [autoScroll, setAutoScroll] = useState(true);

  useEffect(() => {
    if (autoScroll) bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [entries.length, autoScroll]);

  const onScroll = () => {
    const el = containerRef.current;
    if (!el) return;
    const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 60;
    setShowScroll(!atBottom);
    setAutoScroll(atBottom);
  };

  return (
    <div className="flex flex-col flex-1 overflow-hidden relative">
      <div className="flex items-center justify-between px-6 py-3 border-t border-b border-border bg-surface">
        <span className="text-[10px] font-extrabold uppercase tracking-[0.2em] text-dim">Transcript</span>
        <span className="text-[10px] text-dim font-mono">{entries.length} entries</span>
      </div>

      <div ref={containerRef} onScroll={onScroll} className="flex-1 overflow-y-auto px-6 py-4 space-y-3">
        {entries.length === 0 && !isRecording && (
          <div className="text-center mt-16 animate-fade-in">
            <div className="w-16 h-16 mx-auto mb-5 rounded-2xl card-glow flex items-center justify-center animate-float">
              <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-accent">
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
              </svg>
            </div>
            <p className="text-base font-bold text-foreground">No conversation yet</p>
            <p className="text-sm text-dim mt-1">Upload text, audio, or start recording</p>
          </div>
        )}

        {entries.map((e, i) => {
          const idx = hash(e.speaker) % COLORS.length;
          return (
            <div key={`${e.id}-${i}`} className="flex gap-3 animate-fade-in-up" style={{ animationDelay: `${Math.min(i * 25, 150)}ms` }}>
              <div className={`shrink-0 w-8 h-8 rounded-xl ${BG_COLORS[idx]} ${COLORS[idx]} flex items-center justify-center text-[10px] font-black`}>
                {e.speaker.charAt(0).toUpperCase()}
              </div>
              <div className="flex-1 min-w-0 card rounded-2xl rounded-tl-lg px-4 py-3">
                <div className="flex items-center justify-between mb-1.5">
                  <span className={`text-[10px] font-bold uppercase tracking-[0.15em] ${COLORS[idx]}`}>{e.speaker}</span>
                  <span className="text-[9px] text-dim font-mono">{formatTime(e.timestamp)}</span>
                </div>
                <p className="text-[13px] leading-relaxed">{e.text}</p>
              </div>
            </div>
          );
        })}

        {isRecording && (
          <div className="flex gap-3 animate-fade-in">
            <div className="shrink-0 w-8 h-8 rounded-xl bg-red-dim flex items-center justify-center">
              <div className="w-2.5 h-2.5 rounded-full bg-red animate-pulse" />
            </div>
            <div className="card rounded-2xl rounded-tl-lg px-5 py-3.5">
              <div className="flex items-center gap-2">
                <span className="typing-dot" /><span className="typing-dot" /><span className="typing-dot" />
              </div>
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {showScroll && (
        <button onClick={() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); setAutoScroll(true); }}
          className="absolute bottom-4 left-1/2 -translate-x-1/2 card px-5 py-2 text-[10px] uppercase tracking-[0.15em] text-dim hover:text-accent transition-all animate-slide-up cursor-pointer z-10">
          ↓ Latest
        </button>
      )}
    </div>
  );
}
