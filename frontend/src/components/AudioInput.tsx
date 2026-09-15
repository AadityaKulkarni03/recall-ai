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
    <div className="p-6 space-y-4 animate-fade-in">
      <div className="card p-5 space-y-4">
        <div className="flex items-center gap-2 mb-1">
          <span className="w-6 h-6 rounded-lg bg-cyan-dim text-cyan text-[10px] font-black flex items-center justify-center">01</span>
          <span className="text-[11px] font-bold uppercase tracking-[0.15em] text-dim">Upload Audio File</span>
        </div>

        <input
          className="w-full bg-surface border border-border rounded-xl px-4 py-3 text-sm text-foreground placeholder:text-dim/50 focus:outline-none focus:border-accent/25 transition-all"
          value={speaker}
          onChange={(e) => setSpeaker(e.target.value)}
          placeholder="Speaker name"
        />

        <div
          onClick={() => inputRef.current?.click()}
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => { e.preventDefault(); setDragOver(false); if (e.dataTransfer.files.length) handleFile(e.dataTransfer.files[0]); }}
          className={`rounded-2xl p-8 text-center cursor-pointer transition-all duration-300 border-2 border-dashed ${
            dragOver ? "border-accent bg-accent/[0.03] scale-[1.01]" : "border-border hover:border-accent/20"
          }`}
        >
          <div className="text-3xl mb-2 animate-float">🛸</div>
          <p className="text-sm font-semibold text-foreground">Drop audio file here</p>
          <p className="text-[11px] text-dim mt-1">mp3 · wav · m4a · webm · ogg</p>
        </div>

        <input ref={inputRef} type="file" className="hidden" accept=".mp3,.wav,.m4a,.webm,.ogg,.flac,.mp4"
          onChange={(e) => { if (e.target.files?.length) handleFile(e.target.files[0]); }} />

        {file && (
          <div className="card flex items-center gap-3 px-4 py-3 animate-fade-in-up">
            <span className="text-accent text-sm">◈</span>
            <span className="flex-1 truncate text-sm">{file.name}</span>
            <span className="text-[11px] text-dim font-mono">{(file.size / 1024 / 1024).toFixed(1)} MB</span>
          </div>
        )}
      </div>

      <button onClick={handleUpload} disabled={loading || !file}
        className="w-full py-3.5 rounded-2xl text-sm font-extrabold uppercase tracking-[0.1em] transition-all duration-300 cursor-pointer disabled:opacity-25 disabled:cursor-not-allowed bg-accent text-[#060b18] hover:shadow-[0_0_30px_rgba(52,211,153,0.2)] active:scale-[0.98]">
        {loading ? (
          <span className="flex items-center justify-center gap-2">
            <span className="w-4 h-4 border-2 border-[#060b18]/30 border-t-[#060b18] rounded-full animate-spin" />
            Transcribing...
          </span>
        ) : "Transcribe & Index →"}
      </button>
    </div>
  );
}
