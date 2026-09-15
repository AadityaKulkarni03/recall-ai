import type { QueryResponse, UploadResponse, StatusResponse } from "./types";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export async function getStatus(): Promise<StatusResponse> {
  const res = await fetch(`${API_BASE}/api/status`);
  if (!res.ok) throw new Error("Failed to fetch status");
  return res.json();
}

export async function uploadText(
  text: string,
  speaker: string
): Promise<UploadResponse> {
  const res = await fetch(`${API_BASE}/api/upload-text`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text, speaker }),
  });
  if (!res.ok) throw new Error("Failed to upload text");
  return res.json();
}

export async function uploadAudio(
  file: File,
  speaker: string
): Promise<UploadResponse> {
  const form = new FormData();
  form.append("file", file);
  form.append("speaker", speaker);
  const res = await fetch(`${API_BASE}/api/upload-audio`, {
    method: "POST",
    body: form,
  });
  if (!res.ok) throw new Error("Failed to upload audio");
  return res.json();
}

export async function queryIndex(
  question: string,
  useLLM: boolean,
  topK: number = 5
): Promise<QueryResponse> {
  const res = await fetch(`${API_BASE}/api/query`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ question, use_llm: useLLM, top_k: topK }),
  });
  if (!res.ok) throw new Error("Failed to query");
  return res.json();
}

export async function resetSession(): Promise<StatusResponse> {
  const res = await fetch(`${API_BASE}/api/reset`, { method: "POST" });
  if (!res.ok) throw new Error("Failed to reset");
  return res.json();
}

export function getWebSocketURL(): string {
  const base = API_BASE.replace(/^http/, "ws");
  return `${base}/ws/audio`;
}


export async function synthesizeSpeech(text: string): Promise<ArrayBuffer> {
  const res = await fetch(`${API_BASE}/api/tts`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text }),
  });
  if (!res.ok) throw new Error("TTS failed");
  return res.arrayBuffer();
}
