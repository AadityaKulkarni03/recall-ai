"""Tests for the Recall API endpoints."""

from __future__ import annotations

from dataclasses import dataclass
from unittest.mock import AsyncMock, MagicMock

import pytest

pytestmark = pytest.mark.anyio


# ── Health & Status ─────────────────────────────────────────────


async def test_root_returns_json(client):
    """GET / returns a JSON status message."""
    resp = await client.get("/")
    assert resp.status_code == 200
    data = resp.json()
    assert data["status"] == "ok"


async def test_status_endpoint(client, mock_retriever):
    """GET /api/status returns ready status with utterance count."""
    mock_retriever.utterance_count = 7
    resp = await client.get("/api/status")
    assert resp.status_code == 200
    data = resp.json()
    assert data["status"] == "ready"
    assert data["utterance_count"] == 7


# ── Text Upload ─────────────────────────────────────────────────


async def test_upload_text_indexes_chunks(client, mock_retriever):
    """POST /api/upload-text splits text and indexes into Moss."""
    mock_retriever.utterance_count = 3
    mock_retriever.add_chunks = AsyncMock()

    resp = await client.post(
        "/api/upload-text",
        json={
            "text": "The quarterly budget is set at fifty thousand dollars. We need board approval before proceeding with the allocation.",
            "speaker": "Alice",
        },
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["chunks_indexed"] > 0
    assert data["total_utterances"] == 3
    mock_retriever.add_chunks.assert_called_once()


async def test_upload_empty_text(client, mock_retriever):
    """POST /api/upload-text with empty text returns zero chunks."""
    mock_retriever.utterance_count = 0
    resp = await client.post(
        "/api/upload-text",
        json={"text": "", "speaker": "Bob"},
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["chunks_indexed"] == 0


# ── Query ───────────────────────────────────────────────────────


async def test_query_empty_index(client, mock_retriever):
    """POST /api/query with no indexed data returns a helpful message."""
    mock_retriever.utterance_count = 0
    resp = await client.post(
        "/api/query",
        json={"question": "What is the budget?"},
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["passages"] == []
    assert "No conversation" in data["answer"]


async def test_query_retrieval_only(client, mock_retriever):
    """POST /api/query without LLM returns passages only."""

    @dataclass
    class FakePassage:
        id: str = "utt-1"
        text: str = "Budget is 50k"
        score: float = 0.92
        speaker: str = "Alice"
        timestamp: float = 30.0

    @dataclass
    class FakeResult:
        query: str = "budget"
        passages: list = None
        retrieval_ms: float = 4.2

        def __post_init__(self):
            if self.passages is None:
                self.passages = [FakePassage()]

    mock_retriever.utterance_count = 5
    mock_retriever.query = AsyncMock(return_value=FakeResult())

    resp = await client.post(
        "/api/query",
        json={"question": "What is the budget?", "use_llm": False},
    )
    assert resp.status_code == 200
    data = resp.json()
    assert len(data["passages"]) == 1
    assert data["passages"][0]["score"] == 0.92
    assert data["retrieval_ms"] == 4.2
    assert data["answer"] is None


async def test_query_with_llm(client, mock_retriever, mock_generator):
    """POST /api/query with use_llm=true calls the generator."""

    @dataclass
    class FakePassage:
        id: str = "utt-1"
        text: str = "Budget is 50k"
        score: float = 0.85
        speaker: str = "Alice"
        timestamp: float = 30.0

    @dataclass
    class FakeResult:
        query: str = "budget"
        passages: list = None
        retrieval_ms: float = 3.1

        def __post_init__(self):
            if self.passages is None:
                self.passages = [FakePassage()]

    @dataclass
    class FakeAnswer:
        answer: str = "The budget is $50,000."
        model: str = "test-model"
        generation_ms: float = 120.5
        confidence: str = "high"

    mock_retriever.utterance_count = 5
    mock_retriever.query = AsyncMock(return_value=FakeResult())
    mock_generator.generate = AsyncMock(return_value=FakeAnswer())

    resp = await client.post(
        "/api/query",
        json={"question": "What is the budget?", "use_llm": True},
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["answer"] == "The budget is $50,000."
    assert data["generation_ms"] == 120.5
    assert data["confidence"] == "high"
    mock_generator.generate.assert_called_once()


# ── Reset ───────────────────────────────────────────────────────


async def test_reset_session(client, mock_retriever):
    """POST /api/reset clears the session."""
    resp = await client.post("/api/reset")
    assert resp.status_code == 200
    data = resp.json()
    assert data["status"] == "reset"
    assert data["utterance_count"] == 0
    mock_retriever.reset.assert_called_once()


# ── TTS ─────────────────────────────────────────────────────────


async def test_tts_endpoint(client, mock_tts):
    """POST /api/tts returns audio bytes."""

    @dataclass
    class FakeTTS:
        audio_bytes: bytes = b"fake-wav-data"
        content_type: str = "audio/wav"
        generation_ms: float = 250.0

    mock_tts.synthesize = AsyncMock(return_value=FakeTTS())

    resp = await client.post(
        "/api/tts",
        json={"text": "Hello world"},
    )
    assert resp.status_code == 200
    assert resp.headers["content-type"] == "audio/wav"
    assert resp.headers["x-generation-ms"] == "250.0"
    assert resp.content == b"fake-wav-data"


async def test_tts_strips_citations(client, mock_tts):
    """POST /api/tts strips citation markers before synthesizing."""

    @dataclass
    class FakeTTS:
        audio_bytes: bytes = b"audio"
        content_type: str = "audio/wav"
        generation_ms: float = 100.0

    mock_tts.synthesize = AsyncMock(return_value=FakeTTS())

    await client.post(
        "/api/tts",
        json={"text": "The budget is 50k (Alice, 30s) [1]."},
    )
    # Verify the text was cleaned before being sent to TTS
    call_args = mock_tts.synthesize.call_args
    clean_text = call_args[0][0]  # first positional arg
    assert "(Alice" not in clean_text
    assert "[1]" not in clean_text


# ── Text Chunking ───────────────────────────────────────────────


def test_split_text_filters_metadata():
    """_split_text should filter out metadata headers."""
    from app.server import _split_text

    text = """Date: January 15, 2025
Time: 10:00 AM
Location: Conference Room B
Attendees: Alice, Bob

The project timeline has been moved to March.
We need to finalize the design documents by end of February.
The client requested additional features for the mobile app."""

    chunks = _split_text(text, "Speaker")
    # Metadata lines should be filtered out
    for chunk in chunks:
        assert not chunk["text"].startswith("Date:")
        assert not chunk["text"].startswith("Time:")
        assert not chunk["text"].startswith("Location:")
    # Content should be preserved
    all_text = " ".join(c["text"] for c in chunks)
    assert "March" in all_text


def test_split_text_respects_min_chunk_size():
    """_split_text should drop fragments shorter than MIN_CHUNK_CHARS."""
    from app.server import _split_text

    # Very short text should produce no chunks
    chunks = _split_text("Hi.", "Speaker")
    assert len(chunks) == 0
