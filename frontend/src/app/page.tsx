"use client";

import { useState, useEffect, useCallback } from "react";
import Header from "@/components/Header";
import Tabs from "@/components/Tabs";
import TextInput from "@/components/TextInput";
import AudioInput from "@/components/AudioInput";
import LiveAudio from "@/components/LiveAudio";
import Transcript from "@/components/Transcript";
import QueryPanel from "@/components/QueryPanel";
import Toast from "@/components/Toast";
import { getStatus, resetSession } from "@/lib/api";
import type { TranscriptEntry } from "@/lib/types";

const INPUT_TABS = [
  { key: "text", label: "Notes", icon: "📝" },
  { key: "audio", label: "Audio", icon: "🎵" },
  { key: "live", label: "Live", icon: "🎙️" },
];

export default function Home() {
  const [activeTab, setActiveTab] = useState("text");
  const [status, setStatus] = useState<"ready" | "offline" | "connecting">("connecting");
  const [utteranceCount, setUtteranceCount] = useState(0);
  const [transcript, setTranscript] = useState<TranscriptEntry[]>([]);
  const [toast, setToast] = useState({ message: "", type: "" as "success" | "error" | "" });
  const [lastLatency, setLastLatency] = useState<number | null>(null);
  const [isRecording, setIsRecording] = useState(false);

  const showToast = useCallback((message: string, type: "success" | "error") => {
    setToast({ message, type });
  }, []);

  useEffect(() => {
    const check = async () => {
      try {
        const data = await getStatus();
        setStatus("ready");
        setUtteranceCount(data.utterance_count);
      } catch {
        setStatus("offline");
      }
    };
    check();
    const interval = setInterval(check, 10000);
    return () => clearInterval(interval);
  }, []);

  const handleIndexed = useCallback((text: string, speaker: string, totalCount: number) => {
    const lines = text.split("\n").filter((l) => l.trim());
    const newEntries: TranscriptEntry[] = lines.map((line, i) => ({
      id: `t-${Date.now()}-${i}`,
      text: line.trim(),
      speaker,
      timestamp: 0,
    }));
    setTranscript((prev) => [...prev, ...newEntries]);
    setUtteranceCount(totalCount);
  }, []);

  const handleLiveTranscript = useCallback((entry: TranscriptEntry) => {
    setTranscript((prev) => [...prev, entry]);
    setIsRecording(true);
  }, []);

  const handleReset = async () => {
    if (!confirm("Clear all indexed data and start fresh?")) return;
    try {
      await resetSession();
      setUtteranceCount(0);
      setTranscript([]);
      setLastLatency(null);
      showToast("Session reset", "success");
    } catch {
      showToast("Reset failed", "error");
    }
  };

  return (
    <div className="h-screen flex flex-col starfield nebula-glow">
      <Header
        utteranceCount={utteranceCount}
        status={status}
        lastLatencyMs={lastLatency}
        onReset={handleReset}
      />

      <div className="flex-1 flex overflow-hidden">
        {/* LEFT: Input + Transcript (warm tint) */}
        <div className="flex-1 flex flex-col overflow-hidden panel-warm">
          <Tabs tabs={INPUT_TABS} active={activeTab} onChange={setActiveTab} />

          <div className="relative overflow-hidden">
            <div className={activeTab === "text" ? "block" : "hidden"}>
              <TextInput onIndexed={handleIndexed} onToast={showToast} />
            </div>
            <div className={activeTab === "audio" ? "block" : "hidden"}>
              <AudioInput onIndexed={handleIndexed} onToast={showToast} />
            </div>
            <div className={activeTab === "live" ? "block" : "hidden"}>
              <LiveAudio
                onTranscript={handleLiveTranscript}
                onUtteranceCount={setUtteranceCount}
                onToast={(msg, type) => {
                  showToast(msg, type);
                  if (msg.includes("stopped")) setIsRecording(false);
                }}
              />
            </div>
          </div>

          <Transcript entries={transcript} isRecording={isRecording && activeTab === "live"} />
        </div>

        {/* Gradient divider */}
        <div className="divider-glow shrink-0" />

        {/* RIGHT: Query + Results (cool tint) */}
        <div className="flex-1 panel-cool">
          <QueryPanel onLatency={setLastLatency} />
        </div>
      </div>

      <Toast
        message={toast.message}
        type={toast.type}
        onClose={() => setToast({ message: "", type: "" })}
      />
    </div>
  );
}
