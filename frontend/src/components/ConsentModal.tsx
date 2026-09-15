"use client";

interface ConsentModalProps {
  onAccept: () => void;
  onDecline: () => void;
}

export default function ConsentModal({ onAccept, onDecline }: ConsentModalProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-md animate-fade-in">
      <div className="glass-strong rounded-2xl max-w-md w-full mx-4 p-6 space-y-5 animate-slide-up shadow-[0_0_40px_rgba(0,0,0,0.5)]">
        {/* Header with shield */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-green-dim flex items-center justify-center">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="text-green">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
              <path d="m9 12 2 2 4-4" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
          <div>
            <h3 className="text-base font-semibold">Recording Consent</h3>
            <p className="text-[11px] text-dim">Privacy-first audio processing</p>
          </div>
        </div>

        <p className="text-sm text-dim leading-relaxed">
          Recall AI will access your microphone for live transcription.
          Here&apos;s how we handle your data:
        </p>

        <div className="space-y-2.5">
          {[
            { icon: "🔒", text: "Audio is processed in real-time and", bold: "never stored on disk" },
            { icon: "💨", text: "Transcripts are held", bold: "in-memory only", after: "— gone when session ends" },
            { icon: "🗑️", text: "Reset your session", bold: "anytime", after: "to clear all data instantly" },
            { icon: "🔐", text: "Audio sent over", bold: "encrypted WebSocket", after: "to Deepgram" },
          ].map((item, i) => (
            <div
              key={i}
              className="flex items-start gap-3 px-3 py-2.5 rounded-xl bg-surface2/50"
              style={{ animationDelay: `${i * 50}ms` }}
            >
              <span className="text-sm mt-0.5">{item.icon}</span>
              <span className="text-xs text-dim leading-relaxed">
                {item.text} <strong className="text-foreground">{item.bold}</strong>{item.after ? ` ${item.after}` : ""}
              </span>
            </div>
          ))}
        </div>

        <p className="text-[11px] text-dim/60">
          By clicking &quot;I Consent&quot;, you agree to microphone access and
          real-time transcription for this session.
        </p>

        <div className="flex gap-3">
          <button
            onClick={onDecline}
            className="flex-1 px-4 py-2.5 rounded-xl text-sm text-dim border border-border hover:border-foreground/20 hover:text-foreground transition-all duration-200 cursor-pointer"
          >
            Decline
          </button>
          <button
            onClick={onAccept}
            className="flex-1 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all duration-300 cursor-pointer bg-gradient-to-r from-green to-emerald-400 text-black hover:shadow-[0_0_16px_rgba(34,197,94,0.3)] active:scale-[0.98]"
          >
            I Consent
          </button>
        </div>
      </div>
    </div>
  );
}
