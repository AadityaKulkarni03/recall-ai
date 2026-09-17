"use client";

import LogoMark from "./LogoMark";

interface HeaderProps {
  utteranceCount: number;
  status: "ready" | "offline" | "connecting";
  lastLatencyMs: number | null;
  onReset: () => void;
}

export default function Header({ utteranceCount, status, lastLatencyMs, onReset }: HeaderProps) {
  return (
    <header className="relative bg-surface border-b border-border z-10">
      <div className="flex items-center justify-between px-8 py-4">
        {/* Logo */}
        <div className="flex items-center gap-4">
          <div className="w-10 h-10 rounded-2xl bg-accent/10 border border-accent/15 flex items-center justify-center logo-cradle">
            <LogoMark size={34} offline={status === "offline"} />
          </div>
          <div>
            <h1 className="text-xl font-extrabold tracking-tight">
              Recall<span className="text-accent">AI</span>
            </h1>
            <p className="text-[10px] text-dim uppercase tracking-[0.2em] mt-[-2px]">Real-time Meeting Memory</p>
          </div>
        </div>

        {/* Right side */}
        <div className="flex items-center gap-5">
          {/* Latency badge */}
          {lastLatencyMs !== null && (
            <div className={`card flex items-center gap-2 px-4 py-2 text-xs font-mono font-bold ${
              lastLatencyMs < 10 ? "border-accent/20 text-accent animate-pulse-green" : "text-dim"
            }`}>
              ⚡ {lastLatencyMs.toFixed(1)}ms
            </div>
          )}

          {/* Indexed count */}
          <div className="card flex items-center gap-3 px-4 py-2">
            <span className="text-lg font-extrabold text-accent">{utteranceCount}</span>
            <span className="text-[10px] text-dim uppercase tracking-[0.15em]">Indexed</span>
          </div>

          {/* Status */}
          <div className="flex items-center gap-2">
            <div className={`w-2.5 h-2.5 rounded-full ${
              status === "ready" ? "bg-accent shadow-[0_0_8px_rgba(52,211,153,0.6)]" :
              status === "connecting" ? "bg-yellow animate-pulse" : "bg-red"
            }`} />
            <span className="text-[10px] text-dim uppercase tracking-[0.15em]">{status}</span>
          </div>

          {/* Reset */}
          <button onClick={onReset}
            className="card px-4 py-2 text-[10px] uppercase tracking-[0.15em] text-dim hover:border-red/20 hover:text-red transition-all cursor-pointer">
            Reset Session
          </button>
        </div>
      </div>
      <div className="header-scanline" />
    </header>
  );
}
