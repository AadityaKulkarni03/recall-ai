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
  { key: "text", label: "Meeting Notes", icon: "📝" },
  { key: "audio", label: "Audio File", icon: "🎵" },
  { key: "live", label: "Live Audio", icon: "🎙️" },
];

export default function Home() {
  const [activeTab, setActiveTab] = useState("text");
  const [status, setStatus] = useState<"ready" | "offline" | "connecting">("connecting");
  const [utteranceCount, setUtteranceCount] = useState(0);
  const [transcript, setTranscript] = useState<TranscriptEntry[]>([]);
  const [toast, setToast] = useState({ message: "", type: "" as "success" | "error" | "" });

  const showToast = useCallback((message: string, type: "success" | "error") => {
    setToast({ message, type });
  }, []);

  // Poll status
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

  // When text/audio is indexed, add to transcript
  const handleIndexed = useCallback(
    (text: string, speaker: string, totalCount: number) => {
      const lines = text.split("\n").filter((l) => l.trim());
      const newEntries: TranscriptEntry[] = lines.map((line, i) => ({
        id: `t-${Date.now()}-${i}`,
        text: line.trim(),
        speaker,
        timestamp: 0,
      }));
      setTranscript((prev) => [...newEntries, ...prev]);
      setUtteranceCount(totalCount);
    },
    []
  );

  // Live audio transcript entry
  const handleLiveTranscript = useCallback((entry: TranscriptEntry) => {
    setTranscript((prev) => [entry, ...prev]);
  }, []);

  // Reset
  const handleReset = async () => {
    if (!confirm("Clear all indexed data and start fresh?")) return;
    try {
      await resetSession();
      setUtteranceCount(0);
      setTranscript([]);
      showToast("Session reset", "success");
    } catch {
      showToast("Reset failed", "error");
    }
  };

  return (
    <div className="h-screen flex flex-col bg-background">
      <Header
        utteranceCount={utteranceCount}
        status={status}
        onReset={handleReset}
      />

      <div className="flex-1 grid grid-cols-2 overflow-hidden">
        {/* LEFT: Input + Transcript */}
        <div className="flex flex-col border-r border-border overflow-hidden">
          <Tabs tabs={INPUT_TABS} active={activeTab} onChange={setActiveTab} />

          {activeTab === "text" && (
            <TextInput onIndexed={handleIndexed} onToast={showToast} />
          )}
          {activeTab === "audio" && (
            <AudioInput onIndexed={handleIndexed} onToast={showToast} />
          )}
          {activeTab === "live" && (
            <LiveAudio
              onTranscript={handleLiveTranscript}
              onUtteranceCount={setUtteranceCount}
              onToast={showToast}
            />
          )}

          <Transcript entries={transcript} />
        </div>

        {/* RIGHT: Query + Results */}
        <QueryPanel />
      </div>

      <Toast
        message={toast.message}
        type={toast.type}
        onClose={() => setToast({ message: "", type: "" })}
      />
    </div>
  );
}
