# Recall AI

[![CI](https://github.com/AadityaKulkarni03/recall-ai/actions/workflows/ci.yml/badge.svg)](https://github.com/AadityaKulkarni03/recall-ai/actions/workflows/ci.yml)

**Real-time meeting memory with sub-10ms semantic search.**

Recall AI indexes conversations as they happen and lets you search them instantly. Upload meeting notes, audio files, or stream live from your microphone — then ask any question and get answers grounded in what was actually said.

Built for the **Moss Zero Latency Builder Sprint** — Track 1: Real-time Voice & Conversational AI.

---

## How It Works

```
Input (text / audio / mic) → Chunking → Moss Session (embed + index in-memory)
                                                          ↓
               User Question → Moss query (<10ms) → Retrieved Passages
                                                          ↓
                                    [Optional] Groq LLM → Grounded Answer → TTS
```

**Three input modes:**
- 📝 **Meeting Notes** — paste text or attach a document (PDF, DOCX, TXT, MD), semantically chunked and indexed instantly
- 🎵 **Audio File** — transcribed with Groq Whisper, then indexed
- 🎙️ **Live Audio** — real-time streaming via Deepgram Nova-2 with speaker diarization

**Two query modes:**
- ⚡ **Direct retrieval** — raw Moss results in <10ms, fully local, no cloud roundtrip
- 🤖 **AI Summary** — Groq LLM generates a grounded answer with confidence scoring (~0.5s)

**Voice output:**
- 🔊 **Text-to-Speech** — AI answers can be spoken back via Groq Orpheus TTS

---

## Tech Stack

| Component | Technology | Role |
|-----------|-----------|------|
| Semantic Search | [Moss](https://moss.dev) | In-process <10ms retrieval via Rust core |
| Live STT | [Deepgram Nova-2](https://deepgram.com) | Real-time streaming transcription with diarization |
| File STT | [Groq Whisper](https://console.groq.com) | Batch audio file transcription (large-v3-turbo) |
| LLM | [Groq](https://console.groq.com) (gpt-oss-20b) | RAG answer generation with CRISPE prompt framework |
| TTS | [Groq Orpheus](https://console.groq.com) | Text-to-speech for voice output |
| Backend | FastAPI (Python) | REST + WebSocket API with rate limiting |
| Frontend | Next.js 16 + React 19 + Tailwind 4 | Dark-themed UI with 3D visualizations |

---

## Quick Start

### Prerequisites

- Python 3.10+
- Node.js 18+
- API keys: [Moss](https://moss.dev), [Groq](https://console.groq.com), [Deepgram](https://console.deepgram.com) (optional, for live audio)

### Install

```bash
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

---

## Docker

Run the full stack with Docker Compose:

```bash
# Copy and configure environment
cp .env.example .env
# Edit .env with your API keys

# Build and start
docker compose up --build

# Stop
docker compose down
```

Services:
- **Backend** → `http://localhost:8000`
- **Frontend** → `http://localhost:3000`

The backend includes a healthcheck — the frontend waits for it before starting.

---

## Testing

```bash
# Install test dependencies
pip install -r requirements-dev.txt

# Run all tests
pytest

# Run with verbose output
pytest -v
```

Tests mock all external services (Moss, Groq, Deepgram) so they run without API keys.

**Test coverage:**
- Health and status endpoints
- Text upload and chunking
- Document upload (TXT, unsupported types, empty files)
- Query (empty index, retrieval-only, with LLM)
- Input validation (text too long, question too long)
- Session reset
- TTS synthesis and citation stripping
- Text chunking logic (metadata filtering, min chunk size)

---

## API Reference

All endpoints are served at `http://localhost:8000`.

### `GET /api/status`
Health check and session stats.
```json
{ "status": "ready", "utterance_count": 12 }
```

### `POST /api/upload-text`
Index meeting notes as plain text.
```json
{ "text": "The budget is $50k...", "speaker": "Alice" }
```

### `POST /api/upload-audio`
Upload an audio file for transcription and indexing. Accepts `multipart/form-data` with `file` and optional `speaker` field. Supports: mp3, mp4, m4a, wav, webm, ogg, flac. Max: 25MB.

### `POST /api/upload-document`
Upload a document file for text extraction and indexing. Accepts `multipart/form-data` with `file` and optional `speaker` field. Supports: PDF, DOCX, TXT, MD. Max: 10MB.

### `POST /api/query`
Semantic search over indexed conversation.
```json
{ "question": "What is the budget?", "use_llm": true, "top_k": 5 }
```
Response includes `retrieval_ms`, `passages[]`, and optionally `answer`, `generation_ms`, `confidence`.

### `POST /api/tts`
Convert text to speech. Returns WAV audio.
```json
{ "text": "The budget is fifty thousand dollars.", "voice": "diana" }
```

### `POST /api/reset`
Clear the current session and start fresh.

### `WS /ws/audio`
WebSocket endpoint for live audio streaming. Send binary audio frames (webm/opus); receive JSON transcript messages.

---

## Project Structure

```
recall-ai/
├── app/
│   ├── config.py          # Centralized environment config
│   ├── server.py          # FastAPI backend (REST + WebSocket)
│   ├── retriever.py       # Moss session management and semantic search
│   ├── transcriber.py     # Groq Whisper STT wrapper
│   ├── generator.py       # Groq LLM RAG generation (CRISPE framework)
│   └── tts.py             # Groq Orpheus text-to-speech
├── frontend/
│   ├── src/
│   │   ├── app/           # Next.js app router (layout, page, globals)
│   │   ├── components/    # React components (LiveAudio, QueryPanel, etc.)
│   │   └── lib/           # API client and TypeScript types
│   ├── Dockerfile         # Multi-stage frontend Docker build
│   └── package.json
├── tests/
│   ├── conftest.py        # Shared fixtures with mocked services
│   └── test_api.py        # API endpoint tests (17 tests)
├── .github/
│   └── workflows/ci.yml   # GitHub Actions CI (pytest + tsc + lint)
├── Dockerfile             # Backend Docker image
├── docker-compose.yml     # Full-stack orchestration
├── requirements.txt       # Production dependencies
├── requirements-dev.txt   # Test dependencies
├── pytest.ini             # Pytest configuration
├── .env.example           # Environment variable template
└── README.md
```

---

## Architecture Highlights

- **Local-first retrieval** — Moss embeds and indexes documents in-process using its Rust core. No vector database, no cloud dependency for queries. Retrieval consistently under 10ms.
- **Semantic-aware chunking** — text is split at paragraph and sentence boundaries, metadata headers are filtered out, and related sentences are grouped into chunks of ~180 characters for optimal retrieval.
- **Non-blocking I/O** — all Groq SDK calls (STT, LLM, TTS) run in separate threads via `asyncio.to_thread()` to keep the FastAPI event loop responsive.
- **Speaker diarization** — live audio uses Deepgram's diarization to automatically identify different speakers.
- **CRISPE prompt framework** — the LLM system prompt uses Capacity, Role, Insight, Statement, Personality, Experiment structure for consistent, grounded answers with confidence scoring.
- **Rate limiting** — all mutation and query endpoints are rate-limited via slowapi (IP-based).
- **Input validation** — file size limits (25MB audio, 10MB documents), text length limits (100K chars), and query length limits (1K chars) with descriptive error messages.
- **Document ingestion** — PDF text extraction via PyMuPDF, DOCX via XML parsing, plain text and markdown read directly. All fed through the same semantic chunking pipeline.

---

## Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `MOSS_PROJECT_ID` | Yes | — | Moss project identifier |
| `MOSS_PROJECT_KEY` | Yes | — | Moss project API key |
| `GROQ_API_KEY` | Yes | — | Groq API key for LLM, STT, and TTS |
| `DEEPGRAM_API_KEY` | No | `""` | Deepgram API key (required for live audio only) |
| `GROQ_LLM_MODEL` | No | `openai/gpt-oss-20b` | LLM model for RAG generation |
| `GROQ_STT_MODEL` | No | `whisper-large-v3-turbo` | Whisper model for audio transcription |
| `MOSS_SESSION_NAME` | No | `recall-session` | Moss session name |
| `TOP_K` | No | `5` | Number of passages to retrieve per query |

---

## License

MIT
