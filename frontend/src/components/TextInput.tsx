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
    <div className="p-4 space-y-3 animate-fade-in">
      <label className="text-[10px] uppercase tracking-widest text-dim block font-medium">Speaker</label>
      <input
        className="w-full glass rounded-xl px-3.5 py-2.5 text-sm text-foreground focus:outline-none focus:border-accent/30 focus:shadow-[0_0_12px_rgba(52,211,153,0.06)] transition-all"
        value={speaker}
        onChange={(e) => setSpeaker(e.target.value)}
        placeholder="Speaker name"
      />
      <label className="text-[10px] uppercase tracking-widest text-dim block font-medium">Meeting Notes</label>
      <textarea
        className="w-full min-h-[120px] glass rounded-2xl px-4 py-3 text-sm text-foreground resize-y focus:outline-none focus:border-accent/30 focus:shadow-[0_0_12px_rgba(52,211,153,0.06)] transition-all leading-relaxed"
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder={`Paste meeting notes here...\n\nEach paragraph becomes a searchable chunk.`}
      />
      <button
        onClick={handleUpload}
        disabled={loading || !text.trim()}
        className="w-full py-2.5 rounded-xl text-sm font-bold btn-glow-green cursor-pointer disabled:cursor-not-allowed"
      >
        {loading ? (
          <span className="flex items-center justify-center gap-2">
            <span className="w-4 h-4 border-2 border-[#060b18]/30 border-t-[#060b18] rounded-full animate-spin" />
            Indexing...
          </span>
        ) : "⬡ Index Meeting Notes"}
      </button>
    </div>
  );
}
