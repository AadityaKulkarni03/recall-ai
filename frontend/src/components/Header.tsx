"use client";

interface HeaderProps {
  utteranceCount: number;
  status: "ready" | "offline" | "connecting";
  lastLatencyMs: number | null;
  onReset: () => void;
}

export default function Header({ utteranceCount, status, lastLatencyMs, onReset }: HeaderProps) {
  const isfast = lastLatencyMs !== null && lastLatencyMs < 10;

  return (
    <header className="relative glass border-b border-border overflow-hidden">
      <div className="relative z-10 flex items-center justify-between px-6 py-4">
        {/* Logo */}
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-accent/20 flex items-center justify-center">
            <div className="w-3 h-3 rounded-full bg-accent animate-pulse-glow" />
          </div>
          <div>
            <h1 className="text-lg font-bold tracking-tight">
              Recall<span className="text-accent">AI</span>
            </h1>
            <p className="text-[11px] text-dim -mt-0.5">Real-time meeting memory</p>
          </div>
        </div>

        {/* Status indicators */}
        <div className="flex items-center gap-5">
          {/* Last latency */}
          {lastLatencyMs !== null && (
            <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium ${
              isfast
                ? "bg-green-dim text-green animate-pulse-green"
                : "bg-surface2 text-dim"
            }`}>
              <span>⚡</span>
              <span>{lastLatencyMs.toFixed(1)}ms</span>
            </div>
          )}

          {/* Indexed count */}
          <div className="flex items-center gap-2 text-sm">
            <div className="w-5 h-5 rounded-md bg-accent-dim flex items-center justify-center text-accent text-xs font-bold">
              {utteranceCount}
            </div>
            <span className="text-dim text-xs">indexed</span>
          </div>

          {/* Connection status */}
          <div className="flex items-center gap-1.5">
            <div className={`w-2 h-2 rounded-full ${
              status === "ready" ? "bg-green" : status === "connecting" ? "bg-yellow animate-pulse" : "bg-red"
            }`} />
            <span className="text-xs text-dim capitalize">{status}</span>
          </div>

          {/* Reset */}
          <button
            onClick={onReset}
            className="px-3 py-1.5 rounded-lg text-xs text-dim border border-border hover:border-red/40 hover:text-red hover:bg-red-dim transition-all duration-200 cursor-pointer"
          >
            Reset
          </button>
        </div>
      </div>

      {/* Animated wave bar */}
      <div className="header-wave" />
    </header>
  );
}
