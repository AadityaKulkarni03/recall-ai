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
      <div>
        <label className="text-xs text-dim block mb-1">
          Paste meeting notes or transcript
        </label>
        <textarea
          className="w-full min-h-[140px] bg-surface2 border border-border rounded-lg px-3 py-3 text-sm text-foreground resize-y font-sans focus:outline-none focus:border-accent"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={`Paste your meeting notes here...\n\nEach line or paragraph becomes a searchable chunk.\n\nExample:\nAlice: The Q3 budget is 50 thousand dollars.\nBob: We need to finalize the design by Friday.`}
        />
      </div>
      <button
        onClick={handleUpload}
        disabled={loading || !text.trim()}
        className="w-full bg-accent text-black font-semibold py-2.5 rounded-lg text-sm disabled:opacity-40 cursor-pointer hover:opacity-90 transition-opacity"
      >
        {loading ? "Indexing..." : "Index Meeting Notes"}
      </button>
    </div>
  );
}
