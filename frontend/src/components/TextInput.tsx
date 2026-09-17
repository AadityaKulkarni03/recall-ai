"use client";

import { useState, useRef, useCallback } from "react";
import { uploadText, uploadDocument } from "@/lib/api";

const ACCEPTED_TYPES = ".txt,.md,.pdf,.docx";
const ACCEPTED_EXTENSIONS = new Set(["txt", "md", "pdf", "docx"]);

interface TextInputProps {
  onIndexed: (text: string, speaker: string, count: number) => void;
  onToast: (msg: string, type: "success" | "error") => void;
}

export default function TextInput({ onIndexed, onToast }: TextInputProps) {
  const [text, setText] = useState("");
  const [speaker, setSpeaker] = useState("Speaker");
  const [loading, setLoading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [fileName, setFileName] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const pendingFile = useRef<File | null>(null);

  const handleUpload = async () => {
    if (pendingFile.current) {
      await handleFileUpload(pendingFile.current);
      return;
    }
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

  const handleFileUpload = async (file: File) => {
    setLoading(true);
    try {
      const data = await uploadDocument(file, speaker);
      onIndexed(data.transcript, speaker, data.total_utterances);
      onToast(`${data.filename}: indexed ${data.chunks_indexed} chunks`, "success");
      setText("");
      setFileName(null);
      pendingFile.current = null;
    } catch (e: unknown) {
      onToast(`Upload failed: ${e instanceof Error ? e.message : e}`, "error");
    }
    setLoading(false);
  };

  const validateAndSetFile = useCallback((file: File) => {
    const ext = file.name.split(".").pop()?.toLowerCase() || "";
    if (!ACCEPTED_EXTENSIONS.has(ext)) {
      onToast(`Unsupported file type: .${ext}. Use PDF, DOCX, TXT, or MD.`, "error");
      return;
    }
    pendingFile.current = file;
    setFileName(file.name);
    setText("");
  }, [onToast]);

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) validateAndSetFile(file);
  }, [validateAndSetFile]);

  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) validateAndSetFile(file);
    if (fileRef.current) fileRef.current.value = "";
  };

  const clearFile = () => {
    pendingFile.current = null;
    setFileName(null);
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

        {/* File drop zone / textarea */}
        {fileName ? (
          <div className="flex items-center gap-3 bg-surface border border-accent/20 rounded-xl px-4 py-4">
            <div className="w-10 h-10 rounded-xl bg-accent/10 flex items-center justify-center shrink-0">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-accent">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                <polyline points="14 2 14 8 20 8" />
              </svg>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold text-foreground truncate">{fileName}</p>
              <p className="text-[11px] text-dim">Ready to index</p>
            </div>
            <button
              onClick={clearFile}
              className="text-dim hover:text-red text-xs cursor-pointer transition-colors"
              title="Remove file"
            >✕</button>
          </div>
        ) : (
          <div
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={onDrop}
            className={`relative transition-all duration-200 rounded-xl ${
              dragOver ? "ring-2 ring-accent/40 bg-accent/5" : ""
            }`}
          >
            <textarea
              className="w-full min-h-[130px] bg-surface border border-border rounded-xl px-4 py-3 text-sm text-foreground placeholder:text-dim/50 resize-y focus:outline-none focus:border-accent/25 transition-all leading-relaxed"
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder={`Paste your meeting notes here...\n\nOr drag & drop a PDF, DOCX, TXT, or MD file.`}
            />
            {dragOver && (
              <div className="absolute inset-0 bg-accent/10 rounded-xl flex items-center justify-center pointer-events-none">
                <div className="text-center">
                  <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-accent mx-auto mb-2">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                    <polyline points="17 8 12 3 7 8" />
                    <line x1="12" y1="3" x2="12" y2="15" />
                  </svg>
                  <p className="text-sm font-bold text-accent">Drop file here</p>
                </div>
              </div>
            )}
          </div>
        )}

        {/* File picker button */}
        <div className="flex items-center gap-3">
          <input
            ref={fileRef}
            type="file"
            accept={ACCEPTED_TYPES}
            onChange={onFileChange}
            className="hidden"
          />
          <button
            onClick={() => fileRef.current?.click()}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-[11px] font-bold uppercase tracking-[0.1em] text-dim bg-surface border border-border hover:border-accent/20 hover:text-accent transition-all cursor-pointer"
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48" />
            </svg>
            Attach File
          </button>
          <span className="text-[10px] text-dim">PDF, DOCX, TXT, MD</span>
        </div>
      </div>

      <button
        onClick={handleUpload}
        disabled={loading || (!text.trim() && !fileName)}
        className="w-full py-3.5 rounded-2xl text-sm font-extrabold uppercase tracking-[0.1em] transition-all duration-300 cursor-pointer disabled:opacity-25 disabled:cursor-not-allowed bg-accent text-[#060b18] hover:shadow-[0_0_30px_rgba(52,211,153,0.2)] active:scale-[0.98]"
      >
        {loading ? (
          <span className="flex items-center justify-center gap-2">
            <span className="w-4 h-4 border-2 border-[#060b18]/30 border-t-[#060b18] rounded-full animate-spin" />
            {fileName ? "Processing document..." : "Indexing..."}
          </span>
        ) : fileName ? `Index Document →` : "Index Meeting Notes →"}
      </button>
    </div>
  );
}
