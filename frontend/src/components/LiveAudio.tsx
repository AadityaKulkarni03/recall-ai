"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { getWebSocketURL } from "@/lib/api";
import ConsentModal from "./ConsentModal";
import LiveOrb from "./LiveOrb";
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

  // Live microphone amplitude (0–1), sampled straight from an AnalyserNode so
  // the 3D orb can animate without re-rendering this component.
  const levelRef = useRef(0);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const meterRafRef = useRef(0);

  const stopMeter = useCallback(() => {
    if (meterRafRef.current) cancelAnimationFrame(meterRafRef.current);
    meterRafRef.current = 0;
    audioCtxRef.current?.close().catch(() => {});
    audioCtxRef.current = null;
    levelRef.current = 0;
  }, []);

  const startMeter = useCallback((stream: MediaStream) => {
    try {
      const ctx = new AudioContext();
      audioCtxRef.current = ctx;
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 512;
      ctx.createMediaStreamSource(stream).connect(analyser);
      const buf = new Uint8Array(analyser.frequencyBinCount);

      const tick = () => {
        analyser.getByteTimeDomainData(buf);
        // RMS around the 128 midpoint, scaled so normal speech lands near 1.
        let sum = 0;
        for (let i = 0; i < buf.length; i++) {
          const d = (buf[i] - 128) / 128;
          sum += d * d;
        }
        levelRef.current = Math.min(1, Math.sqrt(sum / buf.length) * 4);
        meterRafRef.current = requestAnimationFrame(tick);
      };
      tick();
    } catch {
      // Audio metering is cosmetic — recording still works without it.
      levelRef.current = 0;
    }
  }, []);

  // Release the audio context if the user navigates away mid-recording.
  useEffect(() => stopMeter, [stopMeter]);

  const startRecording = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      startMeter(stream);
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
      onToast("Recording started", "success");
    } catch { stopMeter(); onToast("Microphone access denied", "error"); }
  }, [onTranscript, onUtteranceCount, onToast, startMeter, stopMeter]);

  const handleMicClick = () => {
    if (recording) {
      recorderRef.current?.stop(); recorderRef.current = null; wsRef.current = null;
      stopMeter();
      setRecording(false); onToast("Recording stopped", "success");
    } else if (consented) startRecording();
    else setShowConsent(true);
  };

  return (
    <div className={`p-6 space-y-4 animate-fade-in transition-all duration-500 ${recording ? "recording-glow" : ""}`}>
      {showConsent && (
        <ConsentModal
          onAccept={() => { setConsented(true); setShowConsent(false); startRecording(); }}
          onDecline={() => { setShowConsent(false); onToast("Consent declined", "error"); }}
        />
      )}

      <div className="card p-5 space-y-4">
        <div className="flex items-center gap-2 mb-1">
          <span className="w-6 h-6 rounded-lg bg-red-dim text-red text-[10px] font-black flex items-center justify-center">◉</span>
          <span className="text-[11px] font-bold uppercase tracking-[0.15em] text-dim">Live Microphone</span>
        </div>

        <p className="text-sm text-dim leading-relaxed">
          Stream audio from your microphone. Deepgram transcribes in real-time and Moss indexes each utterance instantly.
        </p>

        {recording && (
          <div className="flex items-center gap-4 px-4 py-3 rounded-xl bg-red-dim border border-red/10 animate-fade-in-up">
            <LiveOrb levelRef={levelRef} size={76} />
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-sm text-red font-semibold">Transcribing live</span>
                <span className="flex items-center gap-1">
                  <span className="typing-dot" style={{ background: "#f87171" }} />
                  <span className="typing-dot" style={{ background: "#f87171" }} />
                  <span className="typing-dot" style={{ background: "#f87171" }} />
                </span>
              </div>
              <p className="text-[11px] text-dim mt-1 font-mono uppercase tracking-[0.12em]">
                Mic open · indexing
              </p>
            </div>
          </div>
        )}

        {consented && !recording && (
          <div className="flex items-center gap-2 text-xs text-dim">
            <span className="text-accent">✓</span> Consent granted for this session
          </div>
        )}
      </div>

      <button onClick={handleMicClick}
        className={`w-full py-3.5 rounded-2xl text-sm font-extrabold uppercase tracking-[0.1em] transition-all duration-300 cursor-pointer ${
          recording
            ? "bg-red text-white animate-pulse-ring shadow-[0_0_30px_rgba(248,113,113,0.15)]"
            : "bg-red text-white hover:shadow-[0_0_30px_rgba(248,113,113,0.2)] active:scale-[0.98]"
        }`}>
        {recording ? "■  Stop Recording" : "●  Start Recording"}
      </button>
    </div>
  );
}
