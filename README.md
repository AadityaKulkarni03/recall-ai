# Recall AI

**Real-time meeting memory with instant semantic search.**

Recall indexes conversations as they happen and lets you search them in under 10ms. Upload meeting notes, audio files, or record live — then ask any question and get instant answers grounded in what was actually said.

## How It Works

```
Input (text / audio / mic) → Chunking → Moss Session (embed + index in-memory)
                                                          ↓
               User Question → Moss query (<10ms) → Retrieved Passages
                                                          ↓
                                    [Optional] Groq LLM → Grounded Answer
```

**Three input modes:**
- 📝 **Meeting Notes** — paste text, chunked and indexed instantly
- 🎵 **Audio File** — transcribed with Groq Whisper, then indexed
- 🎙️ **Live Audio** — real-time streaming transcription via Deepgram, indexed as you speak

**Two query modes:**
- ⚡ **Direct retrieval** — raw Moss results in <10ms, fully local, no cloud
- 🤖 **AI Summary** — Groq LLM generates a grounded answer from retrieved passages (~0.5s)

## Tech Stack

| Component | Technology | Role |
|-----------|-----------|------|
| Semantic Search | [Moss](https://moss.dev) | In-process <10ms retrieval via Rust core |
| Speech-to-Text | Groq Whisper + Deepgram | Audio file + real-time live transcription |
| LLM | Groq (gpt-oss-20b) | Optional RAG answer generation |
| Backend | FastAPI (Python) | REST + WebSocket API |
| Frontend | Next.js + React + Tailwind | Dark-themed UI with live transcript |

## Setup

### Prerequisites

- Python 3.10+
- Node.js 18+
- API keys: [Moss](https://moss.dev), [Groq](https://console.groq.com), [Deepgram](https://console.deepgram.com)

### Install

```bash
# Clone
git clone https://github.com/AadityaKulkarni03/recall-ai.git
cd recall-ai

# Backend
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt

# Frontend
cd frontend
npm install
cd ..

# Environment
cp .env.example .env
# Edit .env with your API keys
```

### Run

```bash
# Terminal 1 — Backend
source .venv/bin/activate
uvicorn app.server:app --host 0.0.0.0 --port 8000

# Terminal 2 — Frontend
cd frontend
npm run dev
```

Open **http://localhost:3000**

## Architecture

- **Moss Sessions** — documents are embedded and indexed in-memory using Moss's Rust core. No vector database, no cloud dependency for queries.
- **Paragraph-aware chunking** — text is split at semantic boundaries, metadata is filtered out, and related sentences are grouped for optimal retrieval.
- **Hybrid search** — Moss combines semantic (vector) and keyword (BM25) search, blended with alpha=0.8 for best results.
- **Deepgram streaming** — live audio flows through WebSocket → Deepgram Nova-3 → real-time transcription → Moss indexing, all in under a second.

## Project Structure

```
recall-ai/
├── app/
│   ├── config.py          # Environment config
│   ├── server.py          # FastAPI backend
│   ├── retriever.py       # Moss session management
│   ├── transcriber.py     # Groq Whisper STT
│   ├── generator.py       # Groq LLM (optional RAG)
│   └── static/index.html  # Standalone HTML frontend
├── frontend/              # Next.js + React frontend
│   └── src/
│       ├── components/    # React components
│       ├── lib/           # API client + types
│       └── app/           # Next.js app router
├── requirements.txt
├── .env.example
└── README.md
```

## License

MIT
