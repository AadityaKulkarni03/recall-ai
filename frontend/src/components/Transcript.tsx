"use client";

import { useEffect, useRef, useState } from "react";
import type { TranscriptEntry } from "@/lib/types";

function formatTime(s: number): string {
  if (!s || s <= 0) return "0:00";
  return `${Math.floor(s / 60)}:${Math.floor(s % 60).toString().padStart(2, "0")}`;
}

const AVATAR_COLORS = [
  "from-accent to-emerald-400",
  "from-cyan to-blue-400",
  "from-purple-400 to-pink-400",
  "from-amber-400 to-orange-400",
  "from-rose-400 to-red-400",
  "from-teal-400 to-cyan",
];

function avatarColor(name: string) {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = name.charCodeAt(i) + ((h << 5) - h);
  return AVATAR_COLORS[Math.abs(h) % AVATAR_COLORS.length];
}

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
      <div className="flex items-center justify-between px-4 py-2.5 border-t border-b border-border glass">
        <span className="text-[10px] font-bold uppercase tracking-[0.15em] text-dim">Transmission Log</span>
        <span className="text-[10px] text-dim font-mono">{entries.length} entries</span>
      </div>

      <div ref={containerRef} onScroll={onScroll} className="flex-1 overflow-y-auto px-4 py-3 space-y-2.5">
        {entries.length === 0 && !isRecording && (
          <div className="text-center mt-14 animate-fade-in">
            <div className="w-14 h-14 mx-auto mb-4 rounded-2xl glass-glow flex items-center justify-center animate-float">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-accent">
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
              </svg>
            </div>
            <p className="text-sm text-dim">Awaiting transmission</p>
            <p className="text-[11px] text-dim/50 mt-1">Upload notes, audio, or go live</p>
          </div>
        )}

        {entries.map((e, i) => (
          <div key={`${e.id}-${i}`} className="flex gap-3 animate-fade-in-up" style={{ animationDelay: `${Math.min(i * 25, 150)}ms` }}>
            <div className={`shrink-0 w-7 h-7 rounded-full bg-gradient-to-br ${avatarColor(e.speaker)} flex items-center justify-center text-[10px] font-bold text-[#060b18] shadow-[0_0_8px_rgba(52,211,153,0.15)]`}>
              {e.speaker.charAt(0).toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <div className="glass-strong rounded-2xl rounded-tl-sm px-3.5 py-2.5 shadow-[0_2px_8px_rgba(0,0,0,0.2)]">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[10px] font-bold text-accent uppercase tracking-wider">{e.speaker}</span>
                  <span className="text-[9px] text-dim font-mono">{formatTime(e.timestamp)}</span>
                </div>
                <p className="text-[13px] leading-relaxed text-foreground/90">{e.text}</p>
              </div>
            </div>
          </div>
        ))}

        {isRecording && (
          <div className="flex gap-3 animate-fade-in">
            <div className="shrink-0 w-7 h-7 rounded-full bg-red/20 flex items-center justify-center">
              <div className="w-2 h-2 rounded-full bg-red animate-pulse" />
            </div>
            <div className="glass-strong rounded-2xl rounded-tl-sm px-4 py-3">
              <div className="flex items-center gap-2">
                <span className="typing-dot" />
                <span className="typing-dot" />
                <span className="typing-dot" />
              </div>
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {showScroll && (
        <button onClick={() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); setAutoScroll(true); }}
          className="absolute bottom-3 left-1/2 -translate-x-1/2 glass-strong px-4 py-1.5 rounded-full text-[10px] text-dim hover:text-accent transition-all animate-slide-up cursor-pointer z-10 uppercase tracking-wider">
          ↓ Latest
        </button>
      )}
    </div>
  );
}
