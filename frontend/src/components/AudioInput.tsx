"use client";

import { useState, useRef, useCallback } from "react";
import { uploadAudio } from "@/lib/api";

interface AudioInputProps {
  onIndexed: (text: string, speaker: string, count: number) => void;
  onToast: (msg: string, type: "success" | "error") => void;
}

export default function AudioInput({ onIndexed, onToast }: AudioInputProps) {
  const [speaker, setSpeaker] = useState("Speaker");
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const handleFile = useCallback((f: File) => setFile(f), []);

  const handleUpload = async () => {
    if (!file) return;
    setLoading(true);
    try {
      const data = await uploadAudio(file, speaker);
      if (data.transcript) onIndexed(data.transcript, speaker, data.total_utterances);
      onToast(`Transcribed & indexed ${data.chunks_indexed} segments`, "success");
      setFile(null);
    } catch (e: unknown) {
      onToast(`Failed: ${e instanceof Error ? e.message : e}`, "error");
    }
    setLoading(false);
  };

  return (
    <div className="p-4 space-y-3 animate-fade-in">
      <label className="text-[10px] uppercase tracking-widest text-dim block font-medium">Speaker</label>
      <input
        className="w-full glass rounded-xl px-3.5 py-2.5 text-sm text-foreground focus:outline-none focus:border-accent/30 transition-all"
        value={speaker}
        onChange={(e) => setSpeaker(e.target.value)}
      />

      <div
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => { e.preventDefault(); setDragOver(false); if (e.dataTransfer.files.length) handleFile(e.dataTransfer.files[0]); }}
        className={`relative rounded-2xl p-8 text-center cursor-pointer transition-all duration-300 border-2 border-dashed ${
          dragOver
            ? "border-accent bg-accent/5 scale-[1.01]"
            : "border-border hover:border-accent/30 hover:bg-accent/[0.02]"
        }`}
      >
        <div className="text-3xl mb-2 animate-float">🛸</div>
        <div className="text-sm text-foreground font-medium">Drop audio file here</div>
        <div className="text-[11px] text-dim mt-1">mp3 · wav · m4a · webm</div>
      </div>

      <input ref={inputRef} type="file" className="hidden" accept=".mp3,.wav,.m4a,.webm,.ogg,.flac,.mp4"
        onChange={(e) => { if (e.target.files?.length) handleFile(e.target.files[0]); }} />

      {file && (
        <div className="flex items-center gap-2 px-3 py-2 glass rounded-xl text-sm animate-fade-in-up">
          <span className="text-accent">◈</span>
          <span className="flex-1 truncate">{file.name}</span>
          <span className="text-dim text-xs font-mono">{(file.size / 1024 / 1024).toFixed(1)}MB</span>
        </div>
      )}

      <button
        onClick={handleUpload}
        disabled={loading || !file}
        className="w-full py-2.5 rounded-xl text-sm font-bold btn-glow-green cursor-pointer disabled:cursor-not-allowed"
      >
        {loading ? (
          <span className="flex items-center justify-center gap-2">
            <span className="w-4 h-4 border-2 border-[#060b18]/30 border-t-[#060b18] rounded-full animate-spin" />
            Transcribing...
          </span>
        ) : "⬡ Transcribe & Index"}
      </button>
    </div>
  );
}
