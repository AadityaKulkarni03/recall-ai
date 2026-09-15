"use client";

import { useState, useRef, useCallback } from "react";
import { getWebSocketURL } from "@/lib/api";
import ConsentModal from "./ConsentModal";
import type { TranscriptEntry } from "@/lib/types";

interface LiveAudioProps {
  onTranscript: (entry: TranscriptEntry) => void;
  onUtteranceCount: (count: number) => void;
  onToast: (msg: string, type: "success" | "error") => void;
}

export default function LiveAudio({ onTranscript, onUtteranceCount, onToast }: LiveAudioProps) {
  const [recording, setRecording] = useState(false);
  const [showConsent, setShowConsent] = useState(false);
  const [consented, setConsented] = useState(false);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const wsRef = useRef<WebSocket | null>(null);

  const startRecording = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const ws = new WebSocket(getWebSocketURL());
      wsRef.current = ws;
      ws.onmessage = (e) => {
        const data = JSON.parse(e.data);
        if (data.type === "transcript") {
          onTranscript({ id: data.id, text: data.text, speaker: data.speaker, timestamp: data.timestamp });
          onUtteranceCount(data.total_utterances);
        } else if (data.type === "error") onToast("STT: " + data.message, "error");
      };
      ws.onerror = () => onToast("WebSocket error", "error");
      ws.onopen = () => {
        const rec = new MediaRecorder(stream, { mimeType: "audio/webm;codecs=opus" });
        recorderRef.current = rec;
        rec.ondataavailable = (e) => { if (e.data.size > 0 && ws.readyState === WebSocket.OPEN) ws.send(e.data); };
        rec.onstop = () => { stream.getTracks().forEach(t => t.stop()); if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ action: "stop" })); };
        rec.start(250);
      };
      setRecording(true);
      onToast("Recording started — Deepgram live STT", "success");
    } catch { onToast("Microphone access denied", "error"); }
  }, [onTranscript, onUtteranceCount, onToast]);

  const handleMicClick = () => {
    if (recording) {
      recorderRef.current?.stop(); recorderRef.current = null; wsRef.current = null;
      setRecording(false); onToast("Recording stopped", "success");
    } else if (consented) startRecording();
    else setShowConsent(true);
  };

  return (
    <div className={`p-4 space-y-4 animate-fade-in transition-all duration-500 ${recording ? "recording-glow" : ""}`}>
      {showConsent && (
        <ConsentModal
          onAccept={() => { setConsented(true); setShowConsent(false); startRecording(); }}
          onDecline={() => { setShowConsent(false); onToast("Consent declined", "error"); }}
        />
      )}

      <p className="text-sm text-dim leading-relaxed">
        Stream audio from your microphone. Deepgram transcribes in real-time, Moss indexes instantly.
      </p>

      <button
        onClick={handleMicClick}
        className={`w-full flex items-center justify-center gap-3 py-3 rounded-xl text-sm font-bold cursor-pointer transition-all duration-300 ${
          recording ? "btn-glow-red animate-pulse-ring" : "btn-glow-red"
        }`}
      >
        <span className="text-lg">{recording ? "◼" : "🎙️"}</span>
        <span>{recording ? "Stop Recording" : "Start Recording"}</span>
      </button>

      {recording && (
        <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-red-dim border border-red/10 animate-fade-in-up">
          <div className="flex items-center gap-1.5">
            <span className="typing-dot" style={{ background: "#f87171" }} />
            <span className="typing-dot" style={{ background: "#f87171" }} />
            <span className="typing-dot" style={{ background: "#f87171" }} />
          </div>
          <span className="text-sm text-red">Transcribing live...</span>
        </div>
      )}

      {consented && !recording && (
        <div className="flex items-center gap-2 text-xs text-dim animate-fade-in">
          <span className="text-accent">✓</span> Consent granted
        </div>
      )}
    </div>
  );
}
