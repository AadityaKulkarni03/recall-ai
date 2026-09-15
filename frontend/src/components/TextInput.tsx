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
      <div>
        <label className="text-[11px] uppercase tracking-wider text-dim block mb-1.5 font-medium">Speaker</label>
        <input
          className="w-full glass rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:border-accent/40 transition-colors"
          value={speaker}
          onChange={(e) => setSpeaker(e.target.value)}
          placeholder="Speaker name"
        />
      </div>
      <div>
        <label className="text-[11px] uppercase tracking-wider text-dim block mb-1.5 font-medium">Meeting Notes</label>
        <textarea
          className="w-full min-h-[130px] glass rounded-xl px-4 py-3 text-sm text-foreground resize-y font-sans focus:outline-none focus:border-accent/40 transition-colors leading-relaxed"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={`Paste your meeting notes here...\n\nEach paragraph becomes a searchable chunk.`}
        />
      </div>
      <button
        onClick={handleUpload}
        disabled={loading || !text.trim()}
        className="w-full py-2.5 rounded-xl text-sm font-semibold transition-all duration-300 cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed bg-gradient-to-r from-accent to-orange-400 text-black hover:shadow-[0_0_20px_rgba(249,115,22,0.3)] active:scale-[0.98]"
      >
        {loading ? (
          <span className="flex items-center justify-center gap-2">
            <span className="w-4 h-4 border-2 border-black/30 border-t-black rounded-full animate-spin" />
            Indexing...
          </span>
        ) : "Index Meeting Notes"}
      </button>
    </div>
  );
}
