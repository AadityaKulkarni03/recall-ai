"use client";

import { useState, useRef, useCallback } from "react";
import { getWebSocketURL } from "@/lib/api";
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
  const recorderRef = useRef<MediaRecorder | null>(null);
  const wsRef = useRef<WebSocket | null>(null);

  const start = useCallback(async () => {
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

      // Wait for WebSocket to open before starting MediaRecorder
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

        // Stream small chunks continuously for real-time Deepgram transcription
        recorder.start(250); // 250ms chunks for low-latency streaming
      };

      setRecording(true);
      onToast("Recording started — Deepgram live STT", "success");
    } catch {
      onToast("Microphone access denied", "error");
    }
  }, [onTranscript, onUtteranceCount, onToast]);

  const stop = useCallback(() => {
    recorderRef.current?.stop();
    recorderRef.current = null;
    wsRef.current = null;
    setRecording(false);
    onToast("Recording stopped", "success");
  }, [onToast]);

  return (
    <div className="p-4 space-y-4">
      <p className="text-sm text-dim">
        Record from your microphone. Audio streams to Deepgram for real-time
        transcription and gets indexed into Moss instantly.
      </p>

      <button
        onClick={recording ? stop : start}
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
    </div>
  );
}
