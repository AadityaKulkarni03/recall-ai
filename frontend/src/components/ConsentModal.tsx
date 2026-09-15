"use client";

interface ConsentModalProps {
  onAccept: () => void;
  onDecline: () => void;
}

export default function ConsentModal({ onAccept, onDecline }: ConsentModalProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-surface border border-border rounded-xl max-w-md w-full mx-4 p-6 space-y-4">
        <div className="text-lg font-semibold flex items-center gap-2">
          <span>🎙️</span> Recording Consent
        </div>

        <p className="text-sm text-dim leading-relaxed">
          Recall AI will access your microphone to capture live audio. The audio
          is streamed to Deepgram for real-time transcription and the resulting
          text is indexed in-memory for semantic search.
        </p>

        <div className="bg-surface2 rounded-lg p-3 text-xs text-dim space-y-2">
          <div className="flex items-start gap-2">
            <span className="text-green mt-0.5">✓</span>
            <span>Audio is processed in real-time and <strong className="text-foreground">never stored on disk</strong></span>
          </div>
          <div className="flex items-start gap-2">
            <span className="text-green mt-0.5">✓</span>
            <span>Transcripts are held <strong className="text-foreground">in-memory only</strong> and deleted when the session ends</span>
          </div>
          <div className="flex items-start gap-2">
            <span className="text-green mt-0.5">✓</span>
            <span>You can <strong className="text-foreground">reset your session</strong> at any time to clear all data</span>
          </div>
          <div className="flex items-start gap-2">
            <span className="text-green mt-0.5">✓</span>
            <span>Audio is sent to Deepgram over an <strong className="text-foreground">encrypted WebSocket</strong> connection</span>
          </div>
        </div>

        <p className="text-xs text-dim">
          By clicking &quot;I Consent&quot;, you agree to microphone access and
          real-time transcription for this session.
        </p>

        <div className="flex gap-3 pt-1">
          <button
            onClick={onDecline}
            className="flex-1 px-4 py-2.5 rounded-lg border border-border text-sm text-dim hover:text-foreground hover:border-foreground transition-colors cursor-pointer"
          >
            Decline
          </button>
          <button
            onClick={onAccept}
            className="flex-1 px-4 py-2.5 rounded-lg bg-accent text-black text-sm font-semibold hover:opacity-90 transition-opacity cursor-pointer"
          >
            I Consent
          </button>
        </div>
      </div>
    </div>
  );
}
