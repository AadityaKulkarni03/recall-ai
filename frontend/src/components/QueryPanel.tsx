"use client";

import { useState } from "react";
import { queryIndex } from "@/lib/api";
import type { QueryResponse } from "@/lib/types";

function formatTime(seconds: number): string {
  if (!seconds || seconds <= 0) return "0:00";
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function formatAnswer(text: string) {
  return text
    .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")
    .replace(/\n/g, "<br>");
}

export default function QueryPanel() {
  const [question, setQuestion] = useState("");
  const [useLLM, setUseLLM] = useState(false);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<QueryResponse | null>(null);

  const handleQuery = async () => {
    if (!question.trim()) return;
    setLoading(true);
    setResult(null);
    try {
      const data = await queryIndex(question, useLLM);
      setResult(data);
    } catch {
      setResult(null);
    }
    setLoading(false);
  };

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="px-5 py-3 border-b border-border bg-surface text-sm font-semibold">
        Ask Anything
      </div>

      {/* Query box */}
      <div className="flex gap-2 px-5 py-3 border-b border-border bg-surface">
        <input
          className="flex-1 bg-surface2 border border-border rounded-lg px-3 py-2.5 text-sm text-foreground focus:outline-none focus:border-accent"
          placeholder="What was discussed about..."
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleQuery()}
        />
        <button
          onClick={handleQuery}
          disabled={loading || !question.trim()}
          className="bg-accent text-black px-5 py-2.5 rounded-lg font-semibold text-sm whitespace-nowrap disabled:opacity-40 cursor-pointer hover:opacity-90 transition-opacity"
        >
          Search
        </button>
      </div>

      {/* LLM toggle */}
      <div className="flex items-center gap-2 px-5 py-2 text-sm text-dim border-b border-border">
        <button
          onClick={() => setUseLLM(!useLLM)}
          className={`relative w-9 h-5 rounded-full cursor-pointer transition-colors ${
            useLLM ? "bg-accent" : "bg-border"
          }`}
        >
          <div
            className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white transition-transform ${
              useLLM ? "translate-x-4" : ""
            }`}
          />
        </button>
        <span>AI Summary</span>
        <span className="text-xs text-dim">(uses Groq LLM ~0.5s)</span>
      </div>

      {/* Results */}
      <div className="flex-1 overflow-y-auto px-5 py-4">
        {loading && (
          <div className="flex items-center gap-2 text-dim text-sm">
            <div className="w-4 h-4 border-2 border-border border-t-accent rounded-full animate-spin" />
            <span>Searching...</span>
          </div>
        )}

        {!loading && !result && (
          <div className="text-center text-dim mt-16">
            <div className="text-4xl mb-3">🔍</div>
            <div>Ask a question about the conversation</div>
            <div className="text-xs mt-1">
              Moss retrieves relevant moments in &lt;10ms
            </div>
          </div>
        )}

        {!loading && result && (
          <div className="bg-surface border border-border rounded-xl p-4 space-y-3">
            {/* Meta */}
            <div className="flex gap-3 text-xs text-dim">
              <span className="text-green font-semibold">
                ⚡ {result.retrieval_ms.toFixed(1)}ms retrieval
              </span>
              {result.generation_ms && (
                <span>🤖 {result.generation_ms.toFixed(0)}ms generation</span>
              )}
              {result.model && <span>{result.model}</span>}
            </div>

            {/* LLM answer */}
            {result.answer && (
              <>
                <div
                  className="text-[15px] leading-relaxed"
                  dangerouslySetInnerHTML={{
                    __html: formatAnswer(result.answer),
                  }}
                />
                <div className="text-xs text-dim">Source passages:</div>
              </>
            )}

            {/* Passages */}
            {result.passages.length > 0 ? (
              <div className="space-y-1.5">
                {result.passages.map((p) => (
                  <div
                    key={p.id}
                    className="bg-surface2 border-l-3 border-accent rounded-r-md px-3 py-2 text-sm"
                  >
                    <span className="text-accent font-semibold text-xs">
                      {(p.score * 100).toFixed(0)}%
                    </span>{" "}
                    <span className="text-dim text-xs">
                      {p.speaker} · {formatTime(p.timestamp)}
                    </span>
                    <div className="mt-1">{p.text}</div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-dim text-sm">
                No matching passages found.
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
