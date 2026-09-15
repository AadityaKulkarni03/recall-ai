"use client";

import { useEffect } from "react";

interface ToastProps {
  message: string;
  type: "success" | "error" | "";
  onClose: () => void;
}

export default function Toast({ message, type, onClose }: ToastProps) {
  useEffect(() => {
    if (!message) return;
    const t = setTimeout(onClose, 3000);
    return () => clearTimeout(t);
  }, [message, onClose]);

  if (!message) return null;

  const styles =
    type === "success"
      ? "border-green/30 bg-green-dim text-green"
      : type === "error"
      ? "border-red/30 bg-red-dim text-red"
      : "border-border bg-surface text-foreground";

  return (
    <div className={`fixed bottom-5 left-1/2 -translate-x-1/2 glass-strong rounded-xl px-5 py-2.5 text-sm z-50 animate-slide-up ${styles}`}>
      {type === "success" && <span className="mr-1.5">✓</span>}
      {type === "error" && <span className="mr-1.5">✕</span>}
      {message}
    </div>
  );
}
