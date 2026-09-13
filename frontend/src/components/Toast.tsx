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

  const borderColor =
    type === "success"
      ? "border-green text-green"
      : type === "error"
      ? "border-red text-red"
      : "border-border text-foreground";

  return (
    <div
      className={`fixed bottom-5 left-1/2 -translate-x-1/2 bg-surface border rounded-lg px-5 py-2.5 text-sm z-50 transition-opacity ${borderColor}`}
    >
      {message}
    </div>
  );
}
