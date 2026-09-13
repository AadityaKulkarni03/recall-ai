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

  const handleFile = useCallback((f: File) => {
    setFile(f);
  }, []);

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
    <div className="p-4 space-y-3">
      <div>
        <label className="text-xs text-dim block mb-1">Speaker Name</label>
        <input
          className="w-full bg-surface2 border border-border rounded-md px-3 py-2 text-sm text-foreground focus:outline-none focus:border-accent"
          value={speaker}
          onChange={(e) => setSpeaker(e.target.value)}
          placeholder="Speaker name"
        />
      </div>

      <div
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          if (e.dataTransfer.files.length) handleFile(e.dataTransfer.files[0]);
        }}
        className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer text-sm transition-all ${
          dragOver
            ? "border-accent text-accent bg-accent-dim"
            : "border-border text-dim hover:border-accent hover:text-accent"
        }`}
      >
        <div className="text-2xl mb-2">🎵</div>
        <div>Drop an audio file here or click to browse</div>
        <div className="text-xs mt-1">mp3, wav, m4a, webm, ogg, flac</div>
      </div>

      <input
        ref={inputRef}
        type="file"
        className="hidden"
        accept=".mp3,.wav,.m4a,.webm,.ogg,.flac,.mp4"
        onChange={(e) => {
          if (e.target.files?.length) handleFile(e.target.files[0]);
        }}
      />

      {file && (
        <div className="text-sm text-dim">
          📎 {file.name} ({(file.size / 1024 / 1024).toFixed(1)} MB)
        </div>
      )}

      <button
        onClick={handleUpload}
        disabled={loading || !file}
        className="w-full bg-accent text-black font-semibold py-2.5 rounded-lg text-sm disabled:opacity-40 cursor-pointer hover:opacity-90 transition-opacity"
      >
        {loading ? "Transcribing..." : "Transcribe & Index"}
      </button>
    </div>
  );
}
