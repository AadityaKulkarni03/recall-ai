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
        } else if (data.type === "error") {
          onToast("STT error: " + data.message, "error");
        }
      };
      ws.onerror = () => onToast("WebSocket error", "error");
      ws.onopen = () => {
        const recorder = new MediaRecorder(stream, { mimeType: "audio/webm;codecs=opus" });
        recorderRef.current = recorder;
        recorder.ondataavailable = (e) => {
          if (e.data.size > 0 && ws.readyState === WebSocket.OPEN) ws.send(e.data);
        };
        recorder.onstop = () => {
          stream.getTracks().forEach((t) => t.stop());
          if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ action: "stop" }));
        };
        recorder.start(250);
      };
      setRecording(true);
      onToast("Recording started — Deepgram live STT", "success");
    } catch {
      onToast("Microphone access denied", "error");
    }
  }, [onTranscript, onUtteranceCount, onToast]);

  const handleMicClick = () => {
    if (recording) {
      recorderRef.current?.stop();
      recorderRef.current = null;
      wsRef.current = null;
      setRecording(false);
      onToast("Recording stopped", "success");
    } else if (consented) {
      startRecording();
    } else {
      setShowConsent(true);
    }
  };

  return (
    <div className={`p-4 space-y-4 animate-fade-in transition-all duration-500 ${recording ? "recording-glow" : ""}`}>
      {showConsent && (
        <ConsentModal
          onAccept={() => { setConsented(true); setShowConsent(false); startRecording(); }}
          onDecline={() => { setShowConsent(false); onToast("Recording consent declined", "error"); }}
        />
      )}

      <p className="text-sm text-dim leading-relaxed">
        Record from your microphone. Audio streams to Deepgram for real-time
        transcription and gets indexed into Moss instantly.
      </p>

      <button
        onClick={handleMicClick}
        className={`w-full flex items-center justify-center gap-3 py-3 rounded-xl text-sm font-semibold cursor-pointer transition-all duration-300 ${
          recording
            ? "bg-red text-white animate-pulse-ring shadow-[0_0_30px_rgba(239,68,68,0.2)]"
            : "bg-gradient-to-r from-red to-rose-400 text-white hover:shadow-[0_0_20px_rgba(239,68,68,0.3)] active:scale-[0.98]"
        }`}
      >
        <span className="text-lg">🎙️</span>
        <span>{recording ? "Stop Recording" : "Start Recording"}</span>
      </button>

      {recording && (
        <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-red-dim animate-fade-in-up">
          <div className="flex items-center gap-1">
            <span className="typing-dot" />
            <span className="typing-dot" />
            <span className="typing-dot" />
          </div>
          <span className="text-sm text-red">Transcribing in real-time...</span>
        </div>
      )}

      {consented && !recording && (
        <div className="flex items-center gap-2 text-xs text-dim animate-fade-in">
          <span className="text-green">✓</span>
          <span>Consent granted for this session</span>
        </div>
      )}
    </div>
  );
}
