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
      onToast(`Transcription failed: ${e instanceof Error ? e.message : e}`, "error");
    }
    setLoading(false);
  };

  return (
    <div className="p-4 space-y-3 animate-fade-in">
      <div>
        <label className="text-[11px] uppercase tracking-wider text-dim block mb-1.5 font-medium">Speaker</label>
        <input
          className="w-full glass rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:border-accent/40 transition-colors"
          value={speaker}
          onChange={(e) => setSpeaker(e.target.value)}
          placeholder="Speaker name"
        />
      </div>

      <div
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => { e.preventDefault(); setDragOver(false); if (e.dataTransfer.files.length) handleFile(e.dataTransfer.files[0]); }}
        className={`relative rounded-xl p-8 text-center cursor-pointer text-sm transition-all duration-300 border-2 border-dashed ${
          dragOver
            ? "border-accent bg-accent-dim scale-[1.01]"
            : "border-border hover:border-accent/40 hover:bg-surface2"
        }`}
      >
        <div className="text-3xl mb-3 animate-float">🎵</div>
        <div className="text-foreground font-medium">Drop audio file here</div>
        <div className="text-xs text-dim mt-1">or click to browse · mp3, wav, m4a, webm</div>
      </div>

      <input
        ref={inputRef}
        type="file"
        className="hidden"
        accept=".mp3,.wav,.m4a,.webm,.ogg,.flac,.mp4"
        onChange={(e) => { if (e.target.files?.length) handleFile(e.target.files[0]); }}
      />

      {file && (
        <div className="flex items-center gap-2 px-3 py-2 glass rounded-lg text-sm animate-fade-in-up">
          <span className="text-accent">📎</span>
          <span className="flex-1 truncate">{file.name}</span>
          <span className="text-dim text-xs">{(file.size / 1024 / 1024).toFixed(1)} MB</span>
        </div>
      )}

      <button
        onClick={handleUpload}
        disabled={loading || !file}
        className="w-full py-2.5 rounded-xl text-sm font-semibold transition-all duration-300 cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed bg-gradient-to-r from-accent to-orange-400 text-black hover:shadow-[0_0_20px_rgba(249,115,22,0.3)] active:scale-[0.98]"
      >
        {loading ? (
          <span className="flex items-center justify-center gap-2">
            <span className="w-4 h-4 border-2 border-black/30 border-t-black rounded-full animate-spin" />
            Transcribing...
          </span>
        ) : "Transcribe & Index"}
      </button>
    </div>
  );
}
