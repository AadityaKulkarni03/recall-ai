"use client";

import type { TranscriptEntry } from "@/lib/types";

function formatTime(seconds: number): string {
  if (!seconds || seconds <= 0) return "0:00";
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

interface TranscriptProps {
  entries: TranscriptEntry[];
}

export default function Transcript({ entries }: TranscriptProps) {
  return (
    <div className="flex flex-col flex-1 overflow-hidden">
      <div className="flex items-center justify-between px-5 py-3 border-t border-b border-border bg-surface text-sm font-semibold">
        <span>Transcript</span>
        <span className="text-xs text-dim font-normal">
          {entries.length} {entries.length === 1 ? "entry" : "entries"}
        </span>
      </div>
      <div className="flex-1 overflow-y-auto px-5 py-3">
        {entries.length === 0 ? (
          <div className="text-center text-dim mt-16">
            <div className="text-4xl mb-3">💬</div>
            <div>No conversation yet</div>
            <div className="text-xs mt-1">
              Upload text, audio, or start recording
            </div>
          </div>
        ) : (
          <ul className="space-y-0">
            {entries.map((entry, i) => (
              <li key={`${entry.id}-${i}`} className="py-2.5 border-b border-border text-sm">
                <span className="text-accent font-semibold text-xs uppercase tracking-wide">
                  {entry.speaker}
                </span>
                <span className="text-dim text-xs ml-2">
                  {formatTime(entry.timestamp)}
                </span>
                <div className="mt-1 leading-relaxed">{entry.text}</div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
