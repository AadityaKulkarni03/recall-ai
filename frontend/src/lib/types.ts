export interface Passage {
  id: string;
  text: string;
  score: number;
  speaker: string;
  timestamp: number;
}

export interface QueryResponse {
  query: string;
  retrieval_ms: number;
  passages: Passage[];
  answer: string | null;
  generation_ms: number | null;
  model: string | null;
  confidence: string | null;
}

export interface UploadResponse {
  message: string;
  chunks_indexed: number;
  total_utterances: number;
  transcript: string | null;
}

export interface StatusResponse {
  status: string;
  utterance_count: number;
}

export interface TranscriptEntry {
  id: string;
  text: string;
  speaker: string;
  timestamp: number;
}

export interface DocumentUploadResponse {
  message: string;
  chunks_indexed: number;
  total_utterances: number;
  transcript: string;
  filename: string;
}
