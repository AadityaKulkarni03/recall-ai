"use client";

import { useState } from "react";
import { uploadText } from "@/lib/api";

interface TextInputProps {
  onIndexed: (text: string, speaker: string, count: number) => void;
  onToast: (msg: string, type: "success" | "error") => void;
}

export default function TextInput({ onIndexed, onToast }: TextInputProps) {
  const [text, setText] = useState("");
  const [speaker, setSpeaker] = useState("Speaker");
  const [loading, setLoading] = useState(false);

  const handleUpload = async () => {
    if (!text.trim()) return;
    setLoading(true);
    try {
      const data = await uploadText(text, speaker);
      onIndexed(text, speaker, data.total_utterances);
      onToast(`Indexed ${data.chunks_indexed} chunks`, "success");
      setText("");
    } catch (e: unknown) {
      onToast(`Upload failed: ${e instanceof Error ? e.message : e}`, "error");
    }
    setLoading(false);
  };

  return (
    <div className="p-6 space-y-4 animate-fade-in">
      <div className="card p-5 space-y-4">
        <div className="flex items-center gap-2 mb-1">
          <span className="w-6 h-6 rounded-lg bg-accent/10 text-accent text-[10px] font-black flex items-center justify-center">01</span>
          <span className="text-[11px] font-bold uppercase tracking-[0.15em] text-dim">Speaker & Notes</span>
        </div>

        <input
          className="w-full bg-surface border border-border rounded-xl px-4 py-3 text-sm text-foreground placeholder:text-dim/50 focus:outline-none focus:border-accent/25 transition-all"
          value={speaker}
          onChange={(e) => setSpeaker(e.target.value)}
          placeholder="Speaker name"
        />

        <textarea
          className="w-full min-h-[130px] bg-surface border border-border rounded-xl px-4 py-3 text-sm text-foreground placeholder:text-dim/50 resize-y focus:outline-none focus:border-accent/25 transition-all leading-relaxed"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={`Paste your meeting notes here...\n\nEach paragraph becomes a searchable chunk.`}
        />
      </div>

      <button
        onClick={handleUpload}
        disabled={loading || !text.trim()}
        className="w-full py-3.5 rounded-2xl text-sm font-extrabold uppercase tracking-[0.1em] transition-all duration-300 cursor-pointer disabled:opacity-25 disabled:cursor-not-allowed bg-accent text-[#060b18] hover:shadow-[0_0_30px_rgba(52,211,153,0.2)] active:scale-[0.98]"
      >
        {loading ? (
          <span className="flex items-center justify-center gap-2">
            <span className="w-4 h-4 border-2 border-[#060b18]/30 border-t-[#060b18] rounded-full animate-spin" />
            Indexing...
          </span>
        ) : "Index Meeting Notes →"}
      </button>
    </div>
  );
}
