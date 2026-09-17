"use client";

import { useEffect } from "react";
import { createPortal } from "react-dom";

interface ConsentModalProps {
  onAccept: () => void;
  onDecline: () => void;
}

export default function ConsentModal({ onAccept, onDecline }: ConsentModalProps) {
  // The dialog is portalled to <body> rather than rendered in place. Sitting
  // inside the tab panel made it subject to that subtree's stacking context
  // and `overflow: hidden`, which let sibling content paint over it however
  // high its z-index went. As a direct child of <body> it competes only with
  // the page's top-level layers.
  // No SSR guard is needed: the parent renders this only after a click, so it
  // never appears in the server output and `document` always exists here.

  // Hold the background still while the dialog is up.
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="consent-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-[#060b18]/80 backdrop-blur-lg animate-fade-in"
    >
      <div className="glass-glow rounded-3xl max-w-md w-full mx-4 p-6 space-y-5 animate-slide-up shadow-[0_0_60px_rgba(52,211,153,0.08)]">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-2xl bg-accent/10 border border-accent/20 flex items-center justify-center">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="text-accent">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
              <path d="m9 12 2 2 4-4" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
          <div>
            <h3 id="consent-title" className="text-base font-bold text-foreground">Secure Recording</h3>
            <p className="text-[10px] text-dim uppercase tracking-wider">Privacy-first protocol</p>
          </div>
        </div>

        <p className="text-sm text-dim leading-relaxed">
          Recall AI will access your microphone for real-time transcription. Your data is handled with care:
        </p>

        <div className="space-y-2">
          {[
            { icon: "🔒", text: "Audio processed in real-time,", bold: "never stored on disk" },
            { icon: "💫", text: "Transcripts held", bold: "in-memory only", after: "— vanish on session end" },
            { icon: "🗑️", text: "Reset anytime to", bold: "clear all data instantly" },
            { icon: "🛡️", text: "Audio sent over", bold: "encrypted connection" },
          ].map((item, i) => (
            <div key={i} className="flex items-start gap-3 px-3 py-2.5 rounded-xl glass">
              <span className="text-sm mt-0.5">{item.icon}</span>
              <span className="text-xs text-dim leading-relaxed">
                {item.text} <strong className="text-foreground">{item.bold}</strong>{item.after || ""}
              </span>
            </div>
          ))}
        </div>

        <div className="flex gap-3 pt-1">
          <button onClick={onDecline}
            className="flex-1 px-4 py-2.5 rounded-xl text-sm text-dim glass hover:text-foreground transition-all cursor-pointer">
            Decline
          </button>
          <button onClick={onAccept}
            className="flex-1 px-4 py-2.5 rounded-xl text-sm font-bold btn-glow-green cursor-pointer">
            ✓ I Consent
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
