"""FastAPI backend — REST endpoints + WebSocket for Recall."""

from __future__ import annotations

import asyncio
import json
import logging
import os
import tempfile
import time
from contextlib import asynccontextmanager
from pathlib import Path
from typing import Optional

from fastapi import FastAPI, File, Form, Request, UploadFile, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from slowapi.util import get_remote_address

from .retriever import Retriever
from .transcriber import Transcriber
from .generator import Generator
from .tts import TextToSpeech

logger = logging.getLogger("recall")

# ── Rate limiter ────────────────────────────────────────────────

limiter = Limiter(key_func=get_remote_address)

# ── Limits ──────────────────────────────────────────────────────

MAX_TEXT_LENGTH = 100_000  # ~100KB of text
MAX_AUDIO_SIZE = 25 * 1024 * 1024  # 25MB
MAX_DOCUMENT_SIZE = 10 * 1024 * 1024  # 10MB

# ── Shared state ────────────────────────────────────────────────

retriever = Retriever()
transcriber = Transcriber()
generator = Generator()
tts_engine = TextToSpeech()

# SSE subscribers for live transcript broadcasts
_transcript_subscribers: list[asyncio.Queue] = []


async def _broadcast_transcript(data: dict) -> None:
    """Push a transcript event to all SSE subscribers."""
    for q in _transcript_subscribers:
        try:
            q.put_nowait(data)
        except asyncio.QueueFull:
            pass


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Initialise Moss session on startup."""
    await retriever.init()
    logger.info("Moss session ready (%d utterances)", retriever.utterance_count)
    yield


app = FastAPI(title="Recall", lifespan=lifespan)
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

# CORS: localhost for dev + ALLOWED_ORIGINS env var for production
_cors_origins = ["http://localhost:3000", "http://127.0.0.1:3000"]
_extra_origins = os.environ.get("ALLOWED_ORIGINS", "")
if _extra_origins:
    _cors_origins.extend([o.strip() for o in _extra_origins.split(",") if o.strip()])

app.add_middleware(
    CORSMiddleware,
    allow_origins=_cors_origins,
    allow_origin_regex=r"^chrome-extension://.*$",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ── Request / Response models ───────────────────────────────────

class QueryRequest(BaseModel):
    question: str
    use_llm: bool = False
    top_k: int = 5


class TextUploadRequest(BaseModel):
    text: str
    speaker: str = "Speaker"


class PassageOut(BaseModel):
    id: str
    text: str
    score: float
    speaker: str
    timestamp: float


class QueryResponse(BaseModel):
    query: str
    retrieval_ms: float
    passages: list[PassageOut]
    # Optional LLM fields
    answer: Optional[str] = None
    generation_ms: Optional[float] = None
    model: Optional[str] = None
    confidence: Optional[str] = None


class UploadResponse(BaseModel):
    message: str
    chunks_indexed: int
    total_utterances: int
    transcript: Optional[str] = None


class StatusResponse(BaseModel):
    status: str
    utterance_count: int


# ── Routes ──────────────────────────────────────────────────────

@app.get("/")
async def index():
    """Root redirect — the Next.js frontend runs separately."""
    return {"status": "ok", "message": "Recall API is running. Frontend is served by Next.js."}


@app.get("/api/status", response_model=StatusResponse)
async def status():
    """Health check + current session stats."""
    return StatusResponse(
        status="ready",
        utterance_count=retriever.utterance_count,
    )


@app.post("/api/upload-text", response_model=UploadResponse)
@limiter.limit("10/minute")
async def upload_text(request: Request, req: TextUploadRequest):
    """Upload meeting notes as plain text. Chunks by paragraph/sentence."""
    if len(req.text) > MAX_TEXT_LENGTH:
        from fastapi.responses import JSONResponse
        return JSONResponse(status_code=400, content={"message": f"Text too long ({len(req.text)} chars). Max: {MAX_TEXT_LENGTH}."})

    chunks = _split_text(req.text, req.speaker)
    if not chunks:
        logger.info("upload-text: no indexable content (speaker=%s)", req.speaker)
        return UploadResponse(message="No text to index", chunks_indexed=0, total_utterances=retriever.utterance_count)

    await retriever.add_chunks(chunks)
    logger.info("upload-text: indexed %d chunks (speaker=%s, total=%d)", len(chunks), req.speaker, retriever.utterance_count)

    return UploadResponse(
        message=f"Indexed {len(chunks)} chunks from text",
        chunks_indexed=len(chunks),
        total_utterances=retriever.utterance_count,
        transcript=req.text,
    )


@app.post("/api/upload-audio", response_model=UploadResponse)
@limiter.limit("10/minute")
async def upload_audio(
    request: Request,
    file: UploadFile = File(...),
    speaker: str = Form("Speaker"),
):
    """Upload an audio file → transcribe with Whisper → index into Moss."""
    audio_bytes = await file.read()
    if len(audio_bytes) > MAX_AUDIO_SIZE:
        from fastapi.responses import JSONResponse
        return JSONResponse(status_code=400, content={"message": f"Audio file too large ({len(audio_bytes) // (1024*1024)}MB). Max: {MAX_AUDIO_SIZE // (1024*1024)}MB."})

    logger.info("upload-audio: received %s (%d bytes, speaker=%s)", file.filename, len(audio_bytes), speaker)

    # Write to temp file (Groq needs a file-like with name)
    suffix = Path(file.filename or "audio.webm").suffix or ".webm"
    with tempfile.NamedTemporaryFile(suffix=suffix, delete=False) as tmp:
        tmp.write(audio_bytes)
        tmp_path = tmp.name

    try:
        result = await transcriber.transcribe_file(tmp_path)
    finally:
        Path(tmp_path).unlink(missing_ok=True)

    chunks = transcriber.segments_to_chunks(result.segments, speaker=speaker)
    if chunks:
        await retriever.add_chunks(chunks)

    logger.info("upload-audio: transcribed %d segments, indexed %d chunks (total=%d)", len(result.segments), len(chunks), retriever.utterance_count)

    return UploadResponse(
        message=f"Transcribed and indexed {len(chunks)} segments",
        chunks_indexed=len(chunks),
        total_utterances=retriever.utterance_count,
        transcript=result.text,
    )


@app.post("/api/query", response_model=QueryResponse)
@limiter.limit("100/minute")
async def query(request: Request, req: QueryRequest):
    """Semantic search over the conversation. Optionally generate an LLM answer."""
    if len(req.question) > 1000:
        from fastapi.responses import JSONResponse
        return JSONResponse(status_code=400, content={"message": "Question too long. Max: 1000 characters."})

    if retriever.utterance_count == 0:
        return QueryResponse(
            query=req.question,
            retrieval_ms=0,
            passages=[],
            answer="No conversation has been indexed yet. Upload text or audio first.",
        )

    # Moss retrieval (<10ms)
    result = await retriever.query(req.question, top_k=req.top_k)
    logger.info("query: q=%r retrieval=%.1fms passages=%d use_llm=%s", req.question, result.retrieval_ms, len(result.passages), req.use_llm)

    passages_out = [
        PassageOut(
            id=p.id,
            text=p.text,
            score=p.score,
            speaker=p.speaker,
            timestamp=p.timestamp,
        )
        for p in result.passages
    ]

    response = QueryResponse(
        query=result.query,
        retrieval_ms=result.retrieval_ms,
        passages=passages_out,
    )

    # Optional LLM generation
    if req.use_llm and result.passages:
        gen = await generator.generate(req.question, result.passages)
        response.answer = gen.answer
        response.generation_ms = gen.generation_ms
        response.model = gen.model
        response.confidence = gen.confidence
        logger.info("query: LLM generation=%.1fms model=%s confidence=%s", gen.generation_ms, gen.model, gen.confidence)

    return response


# ── Streaming query endpoint (SSE) ──────────────────────────────

@app.post("/api/query/stream")
@limiter.limit("100/minute")
async def query_stream(request: Request, req: QueryRequest):
    """Streaming semantic search — returns SSE with tokens as they arrive."""
    from fastapi.responses import StreamingResponse

    if len(req.question) > 1000:
        from fastapi.responses import JSONResponse
        return JSONResponse(status_code=400, content={"message": "Question too long. Max: 1000 characters."})

    if retriever.utterance_count == 0:
        async def empty():
            yield f"data: {json.dumps({'type': 'answer', 'token': 'No conversation has been indexed yet. Upload text or audio first.'})}\n\n"
            yield f"data: {json.dumps({'type': 'done'})}\n\n"
        return StreamingResponse(empty(), media_type="text/event-stream")

    result = await retriever.query(req.question, top_k=req.top_k)
    logger.info("query-stream: q=%r retrieval=%.1fms passages=%d", req.question, result.retrieval_ms, len(result.passages))

    passages_out = [
        {"id": p.id, "text": p.text, "score": p.score, "speaker": p.speaker, "timestamp": p.timestamp}
        for p in result.passages
    ]

    async def event_stream():
        # Send retrieval results first
        yield f"data: {json.dumps({'type': 'retrieval', 'retrieval_ms': result.retrieval_ms, 'passages': passages_out})}\n\n"

        if not req.use_llm or not result.passages:
            yield f"data: {json.dumps({'type': 'done'})}\n\n"
            return

        # Stream LLM tokens
        async for token in generator.generate_stream(req.question, result.passages):
            yield f"data: {json.dumps({'type': 'token', 'token': token})}\n\n"

        yield f"data: {json.dumps({'type': 'done'})}\n\n"

    return StreamingResponse(event_stream(), media_type="text/event-stream")


# ── Summarize endpoint ──────────────────────────────────────────

@app.post("/api/summarize")
@limiter.limit("20/minute")
async def summarize(request: Request):
    """Generate a full meeting summary from all indexed content."""
    from fastapi.responses import StreamingResponse

    if retriever.utterance_count == 0:
        async def empty():
            yield f"data: {json.dumps({'type': 'token', 'token': 'No conversation has been indexed yet.'})}\n\n"
            yield f"data: {json.dumps({'type': 'done'})}\n\n"
        return StreamingResponse(empty(), media_type="text/event-stream")

    # Retrieve all content by querying with a broad question
    result = await retriever.query("summarize everything discussed", top_k=20)
    logger.info("summarize: retrieved %d passages for summary", len(result.passages))

    async def event_stream():
        yield f"data: {json.dumps({'type': 'retrieval', 'retrieval_ms': result.retrieval_ms, 'passage_count': len(result.passages)})}\n\n"

        async for token in generator.summarize_stream(result.passages):
            yield f"data: {json.dumps({'type': 'token', 'token': token})}\n\n"

        yield f"data: {json.dumps({'type': 'done'})}\n\n"

    return StreamingResponse(event_stream(), media_type="text/event-stream")


@app.post("/api/reset", response_model=StatusResponse)
async def reset_session():
    """Clear the current session and start fresh."""
    await retriever.reset()
    logger.info("Session reset")
    return StatusResponse(status="reset", utterance_count=0)


# ── Live transcript SSE stream ───────────────────────────────────

@app.get("/api/transcripts/stream")
async def transcript_stream():
    """SSE endpoint — streams all new transcripts from any source (mic, extension, upload)."""
    from fastapi.responses import StreamingResponse

    q: asyncio.Queue = asyncio.Queue(maxsize=100)
    _transcript_subscribers.append(q)

    async def event_generator():
        try:
            while True:
                data = await q.get()
                yield f"data: {json.dumps(data)}\n\n"
        except asyncio.CancelledError:
            pass
        finally:
            _transcript_subscribers.remove(q)

    return StreamingResponse(event_generator(), media_type="text/event-stream")


# ── Document upload (PDF, DOCX, TXT, MD) ───────────────────────

class DocumentUploadResponse(BaseModel):
    message: str
    chunks_indexed: int
    total_utterances: int
    transcript: str
    filename: str


@app.post("/api/upload-document", response_model=DocumentUploadResponse)
@limiter.limit("10/minute")
async def upload_document(
    request: Request,
    file: UploadFile = File(...),
    speaker: str = Form("Speaker"),
):
    """Upload a document file (PDF, TXT, MD, DOCX) → extract text → index into Moss."""
    import asyncio

    filename = file.filename or "document"
    suffix = Path(filename).suffix.lower()
    allowed = {".pdf", ".txt", ".md", ".docx"}
    if suffix not in allowed:
        from fastapi.responses import JSONResponse
        return JSONResponse(
            status_code=400,
            content={"message": f"Unsupported file type: {suffix}. Allowed: {', '.join(allowed)}"},
        )

    file_bytes = await file.read()
    if len(file_bytes) > MAX_DOCUMENT_SIZE:
        from fastapi.responses import JSONResponse
        return JSONResponse(status_code=400, content={"message": f"Document too large ({len(file_bytes) // (1024*1024)}MB). Max: {MAX_DOCUMENT_SIZE // (1024*1024)}MB."})

    logger.info("upload-document: received %s (%d bytes, speaker=%s)", filename, len(file_bytes), speaker)

    # Extract text based on file type
    extracted_text = ""
    if suffix in (".txt", ".md"):
        extracted_text = file_bytes.decode("utf-8", errors="replace")
    elif suffix == ".pdf":
        extracted_text = await asyncio.to_thread(_extract_pdf_text, file_bytes)
    elif suffix == ".docx":
        extracted_text = await asyncio.to_thread(_extract_docx_text, file_bytes)

    extracted_text = extracted_text.strip()
    if not extracted_text:
        return DocumentUploadResponse(
            message="No text could be extracted from the document",
            chunks_indexed=0,
            total_utterances=retriever.utterance_count,
            transcript="",
            filename=filename,
        )

    chunks = _split_text(extracted_text, speaker)
    if chunks:
        await retriever.add_chunks(chunks)

    logger.info("upload-document: extracted %d chars, indexed %d chunks from %s", len(extracted_text), len(chunks), filename)

    return DocumentUploadResponse(
        message=f"Extracted and indexed {len(chunks)} chunks from {filename}",
        chunks_indexed=len(chunks),
        total_utterances=retriever.utterance_count,
        transcript=extracted_text,
        filename=filename,
    )


def _extract_pdf_text(pdf_bytes: bytes) -> str:
    """Extract text from PDF bytes using PyMuPDF."""
    import fitz  # PyMuPDF

    text_parts = []
    with fitz.open(stream=pdf_bytes, filetype="pdf") as doc:
        for page in doc:
            text_parts.append(page.get_text())
    return "\n\n".join(text_parts)


def _extract_docx_text(docx_bytes: bytes) -> str:
    """Extract text from DOCX bytes using zipfile + XML parsing."""
    import io
    import zipfile
    import xml.etree.ElementTree as ET

    with zipfile.ZipFile(io.BytesIO(docx_bytes)) as zf:
        if "word/document.xml" not in zf.namelist():
            return ""
        with zf.open("word/document.xml") as f:
            tree = ET.parse(f)
    ns = {"w": "http://schemas.openxmlformats.org/wordprocessingml/2006/main"}
    paragraphs = []
    for p in tree.iter(f"{{{ns['w']}}}p"):
        texts = [t.text for t in p.iter(f"{{{ns['w']}}}t") if t.text]
        if texts:
            paragraphs.append("".join(texts))
    return "\n\n".join(paragraphs)


# ── TTS endpoint ────────────────────────────────────────────────

class TTSRequest(BaseModel):
    text: str
    voice: Optional[str] = None


@app.post("/api/tts")
@limiter.limit("20/minute")
async def text_to_speech(request: Request, req: TTSRequest):
    """Convert text to speech audio. Returns WAV audio.

    Automatically strips citation markers like (Speaker, 14s) [1] from
    the text so TTS reads naturally.
    """
    import re
    from fastapi.responses import Response

    # Strip citation markers for natural speech
    clean = req.text
    clean = re.sub(r'\s*\([\w\s]+,\s*[\d?]+s?\)\s*', ' ', clean)  # (Speaker, 14s)
    clean = re.sub(r'\s*\[\d+\]\s*', ' ', clean)                    # [1]
    clean = re.sub(r'\*\*(.*?)\*\*', r'\1', clean)                  # **bold**
    clean = re.sub(r'\s+and\s+\.', '.', clean)                      # dangling "and ."
    clean = re.sub(r'\s{2,}', ' ', clean).strip()                   # collapse spaces

    result = await tts_engine.synthesize(clean, voice=req.voice)
    return Response(
        content=result.audio_bytes,
        media_type=result.content_type,
        headers={
            "X-Generation-Ms": str(result.generation_ms),
        },
    )


# ── WebSocket for live audio (Deepgram streaming STT) ───────────

@app.websocket("/ws/audio")
async def ws_audio(ws: WebSocket):
    """Stream live audio from the browser mic via Deepgram real-time STT.

    Protocol:
    - Client sends binary audio frames (webm/opus) continuously.
    - Client sends JSON text messages for control: {"action": "stop"}
    - Server replies with JSON: {"type": "transcript", "text": ..., ...}
    - Uses Deepgram streaming for word-level real-time transcription.
    """
    import asyncio
    import websockets as ws_lib
    from . import config

    await ws.accept()
    logger.info("ws-audio: client connected")
    deepgram_url = (
        "wss://api.deepgram.com/v1/listen"
        "?model=nova-2"
        "&punctuate=true"
        "&interim_results=true"
        "&utterance_end_ms=1500"
        "&smart_format=true"
        "&diarize=true"
    )
    headers = {"Authorization": f"Token {config.DEEPGRAM_API_KEY}"}

    dg_ws = None
    try:
        dg_ws = await ws_lib.connect(deepgram_url, additional_headers=headers)

        # Task: forward Deepgram transcripts back to the browser
        async def relay_transcripts():
            try:
                async for msg in dg_ws:
                    data = json.loads(msg)
                    # Only process final transcripts (skip interim results)
                    if data.get("type") == "Results":
                        is_final = data.get("is_final", False)
                        if not is_final:
                            continue
                        channel = data.get("channel", {})
                        alt = (channel.get("alternatives") or [{}])[0]
                        transcript_text = alt.get("transcript", "").strip()
                        if transcript_text:
                            # Extract speaker from diarization if available
                            words = alt.get("words", [])
                            if words and "speaker" in words[0]:
                                speaker = f"Speaker {words[0]['speaker']}"
                            else:
                                speaker = "Speaker"
                            utt = await retriever.add_utterance(
                                text=transcript_text,
                                speaker=speaker,
                                timestamp=time.time(),
                            )
                            await ws.send_json({
                                "type": "transcript",
                                "id": utt.id,
                                "text": transcript_text,
                                "speaker": utt.speaker,
                                "timestamp": utt.timestamp,
                                "total_utterances": retriever.utterance_count,
                            })
                            # Broadcast to all SSE subscribers (frontend)
                            await _broadcast_transcript({
                                "type": "transcript",
                                "id": utt.id,
                                "text": transcript_text,
                                "speaker": utt.speaker,
                                "timestamp": utt.timestamp,
                                "total_utterances": retriever.utterance_count,
                            })
            except (ws_lib.exceptions.ConnectionClosed, Exception):
                pass

        relay_task = asyncio.create_task(relay_transcripts())

        # Main loop: forward browser audio to Deepgram
        try:
            while True:
                message = await ws.receive()
                if "bytes" in message and message["bytes"]:
                    if dg_ws and dg_ws.state.name == "OPEN":
                        await dg_ws.send(message["bytes"])
                        logger.debug("ws-audio: forwarded %d bytes to Deepgram", len(message["bytes"]))
                elif "text" in message and message["text"]:
                    data = json.loads(message["text"])
                    if data.get("action") == "stop":
                        await ws.send_json({
                            "type": "stopped",
                            "total_utterances": retriever.utterance_count,
                        })
                        break
        except (WebSocketDisconnect, RuntimeError):
            pass
        finally:
            relay_task.cancel()
            if dg_ws and dg_ws.state.name == "OPEN":
                await dg_ws.close()

    except Exception as e:
        logger.exception("Deepgram WebSocket error")
        try:
            await ws.send_json({"type": "error", "message": f"Deepgram connection failed: {e}"})
        except Exception:
            pass


# ── Helpers ─────────────────────────────────────────────────────

def _split_text(text: str, speaker: str) -> list[dict]:
    """Semantic-aware chunking for meeting notes.

    Strategy:
    1. Strip out metadata headers (date, time, location, attendees, etc.)
    2. Keep only conversational/substantive content.
    3. Group consecutive sentences within paragraphs up to target size.
    """
    import re

    TARGET_CHUNK_CHARS = 180
    MAX_CHUNK_CHARS = 350
    MIN_CHUNK_CHARS = 40

    # Patterns for metadata lines to skip
    METADATA_RE = re.compile(
        r'^(date|time|location|meeting type|attendees|meeting objective'
        r'|executive summary|action items|key focus|decision|next steps'
        r'|verbatim transcript|key conversation'
        r'|shri |prime minister.*\(|jane.*\(|lead technology'
        r'|discussion on localizing|agenda)'
        r'.*$',
        re.IGNORECASE,
    )

    # Split into paragraphs
    raw_paragraphs = text.split("\n\n")
    if len(raw_paragraphs) <= 1:
        raw_paragraphs = text.split("\n")

    paragraphs = [p.strip() for p in raw_paragraphs if p.strip()]

    # Filter out metadata paragraphs and split into sentences
    all_groups: list[list[str]] = []
    for para in paragraphs:
        # Skip metadata lines
        lines = para.split("\n")
        content_lines = [
            l.strip() for l in lines
            if l.strip() and not METADATA_RE.match(l.strip())
        ]
        if not content_lines:
            continue

        cleaned = " ".join(content_lines)

        # Split into sentences
        sents = [s.strip() for s in re.split(r'(?<=[.!?])\s+', cleaned) if s.strip()]
        if not sents:
            sents = [cleaned]

        # Filter out short non-content fragments
        sents = [s for s in sents if len(s) >= 20]
        if sents:
            all_groups.append(sents)

    # Build chunks: merge sentences within a paragraph up to TARGET size.
    chunks: list[dict] = []
    timestamp = 0.0

    for group in all_groups:
        buffer = ""
        for sent in group:
            candidate = (buffer + " " + sent).strip() if buffer else sent
            if len(candidate) > MAX_CHUNK_CHARS and buffer:
                if len(buffer) >= MIN_CHUNK_CHARS:
                    chunks.append({"text": buffer, "speaker": speaker, "timestamp": timestamp})
                    timestamp += 5.0
                buffer = sent
            elif len(candidate) >= TARGET_CHUNK_CHARS:
                if len(candidate) >= MIN_CHUNK_CHARS:
                    chunks.append({"text": candidate, "speaker": speaker, "timestamp": timestamp})
                    timestamp += 5.0
                buffer = ""
            else:
                buffer = candidate

        if buffer.strip() and len(buffer.strip()) >= MIN_CHUNK_CHARS:
            chunks.append({"text": buffer.strip(), "speaker": speaker, "timestamp": timestamp})
            timestamp += 5.0

    return chunks
