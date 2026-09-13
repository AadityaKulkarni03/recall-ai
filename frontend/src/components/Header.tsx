"use client";

interface HeaderProps {
  utteranceCount: number;
  status: "ready" | "offline" | "connecting";
  onReset: () => void;
}

export default function Header({ utteranceCount, status, onReset }: HeaderProps) {
  const statusColor =
    status === "ready"
      ? "bg-green"
      : status === "connecting"
      ? "bg-yellow-400"
      : "bg-red";

  return (
    <header className="flex items-center justify-between px-6 py-4 border-b border-border">
      <div className="text-xl font-bold">
        <span className="text-accent">●</span> Recall
      </div>
      <div className="flex items-center gap-3 text-sm text-dim">
        <div className={`w-2 h-2 rounded-full ${statusColor}`} />
        <span className="capitalize">{status}</span>
        <span>·</span>
        <span>
          <strong className="text-foreground">{utteranceCount}</strong> indexed
        </span>
        <button
          onClick={onReset}
          className="ml-2 px-3 py-1.5 rounded-md border border-border text-dim text-xs hover:border-red hover:text-red transition-colors cursor-pointer"
        >
          Reset Session
        </button>
      </div>
    </header>
  );
}
