"use client";

interface HeaderProps {
  utteranceCount: number;
  status: "ready" | "offline" | "connecting";
  lastLatencyMs: number | null;
  onReset: () => void;
}

export default function Header({ utteranceCount, status, lastLatencyMs, onReset }: HeaderProps) {
  return (
    <header className="relative glass border-b border-border overflow-hidden z-10">
      <div className="relative z-10 flex items-center justify-between px-6 py-3.5">
        {/* Logo */}
        <div className="flex items-center gap-3">
          <div className="relative w-9 h-9 rounded-xl bg-accent/10 border border-accent/20 flex items-center justify-center">
            <div className="w-3 h-3 rounded-full bg-accent animate-pulse-glow" />
            <div className="absolute inset-0 rounded-xl bg-accent/5 animate-border-glow border border-transparent" />
          </div>
          <div>
            <h1 className="text-lg font-bold tracking-tight text-foreground">
              Recall<span className="text-accent">AI</span>
            </h1>
            <p className="text-[10px] text-dim -mt-0.5 tracking-wide uppercase">Galactic Memory Engine</p>
          </div>
        </div>

        {/* Status bar */}
        <div className="flex items-center gap-4">
          {lastLatencyMs !== null && (
            <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-mono font-semibold ${
              lastLatencyMs < 10
                ? "bg-accent/10 text-accent border border-accent/20 animate-pulse-green"
                : "glass text-dim"
            }`}>
              ⚡ {lastLatencyMs.toFixed(1)}ms
            </div>
          )}

          <div className="flex items-center gap-2 glass rounded-full px-3 py-1.5">
            <span className="text-accent font-mono font-bold text-sm">{utteranceCount}</span>
            <span className="text-[10px] text-dim uppercase tracking-wider">indexed</span>
          </div>

          <div className="flex items-center gap-1.5">
            <div className={`w-2 h-2 rounded-full ${
              status === "ready" ? "bg-accent shadow-[0_0_6px_rgba(52,211,153,0.5)]" :
              status === "connecting" ? "bg-yellow animate-pulse" : "bg-red"
            }`} />
            <span className="text-[10px] text-dim uppercase tracking-wider">{status}</span>
          </div>

          <button
            onClick={onReset}
            className="px-3 py-1.5 rounded-lg text-[10px] uppercase tracking-wider text-dim glass hover:border-red/30 hover:text-red transition-all duration-300 cursor-pointer"
          >
            Reset
          </button>
        </div>
      </div>
      <div className="header-scanline" />
    </header>
  );
}
