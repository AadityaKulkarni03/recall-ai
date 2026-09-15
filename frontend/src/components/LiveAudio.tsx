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

export default function LiveAudio({
  onTranscript,
  onUtteranceCount,
  onToast,
}: LiveAudioProps) {
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
          onTranscript({
            id: data.id,
            text: data.text,
            speaker: data.speaker,
            timestamp: data.timestamp,
          });
          onUtteranceCount(data.total_utterances);
        } else if (data.type === "error") {
          onToast("STT error: " + data.message, "error");
        }
      };

      ws.onerror = () => onToast("WebSocket error", "error");

      ws.onopen = () => {
        const recorder = new MediaRecorder(stream, {
          mimeType: "audio/webm;codecs=opus",
        });
        recorderRef.current = recorder;

        recorder.ondataavailable = (e) => {
          if (e.data.size > 0 && ws.readyState === WebSocket.OPEN) {
            ws.send(e.data);
          }
        };

        recorder.onstop = () => {
          stream.getTracks().forEach((t) => t.stop());
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ action: "stop" }));
          }
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

  const handleConsent = () => {
    setConsented(true);
    setShowConsent(false);
    startRecording();
  };

  const handleDecline = () => {
    setShowConsent(false);
    onToast("Recording consent declined", "error");
  };

  return (
    <div className="p-4 space-y-4">
      {showConsent && (
        <ConsentModal onAccept={handleConsent} onDecline={handleDecline} />
      )}

      <p className="text-sm text-dim">
        Record from your microphone. Audio streams to Deepgram for real-time
        transcription and gets indexed into Moss instantly.
      </p>

      <button
        onClick={handleMicClick}
        className={`w-full flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-semibold cursor-pointer transition-all ${
          recording
            ? "bg-red text-white animate-pulse-ring"
            : "bg-red text-white hover:opacity-90"
        }`}
      >
        <span>🎙️</span>
        <span>{recording ? "Stop Recording" : "Start Recording"}</span>
      </button>

      {recording && (
        <div className="text-sm text-dim">
          🔴 Recording... Deepgram is transcribing in real-time
        </div>
      )}

      {consented && !recording && (
        <div className="text-xs text-dim flex items-center gap-1">
          <span className="text-green">✓</span> Recording consent granted for this session
        </div>
      )}
    </div>
  );
}
