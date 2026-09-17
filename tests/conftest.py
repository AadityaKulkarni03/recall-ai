"""Shared fixtures — mock all external services so tests run without API keys."""

from __future__ import annotations

import os
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from httpx import ASGITransport, AsyncClient

# Set dummy env vars BEFORE importing app modules
os.environ.setdefault("MOSS_PROJECT_ID", "test-project")
os.environ.setdefault("MOSS_PROJECT_KEY", "test-key")
os.environ.setdefault("GROQ_API_KEY", "test-groq-key")
os.environ.setdefault("DEEPGRAM_API_KEY", "test-deepgram-key")


@pytest.fixture()
def mock_retriever():
    """Patch the module-level retriever in server.py."""
    with patch("app.server.retriever") as mock:
        mock.init = AsyncMock()
        mock.utterance_count = 0
        mock.utterances = []
        mock.add_utterance = AsyncMock()
        mock.add_chunks = AsyncMock()
        mock.reset = AsyncMock()
        mock.query = AsyncMock()
        yield mock


@pytest.fixture()
def mock_transcriber():
    """Patch the module-level transcriber in server.py."""
    with patch("app.server.transcriber") as mock:
        mock.transcribe_file = AsyncMock()
        mock.transcribe_bytes = AsyncMock()
        mock.segments_to_chunks = MagicMock(return_value=[])
        yield mock


@pytest.fixture()
def mock_generator():
    """Patch the module-level generator in server.py."""
    with patch("app.server.generator") as mock:
        mock.generate = AsyncMock()
        yield mock


@pytest.fixture()
def mock_tts():
    """Patch the module-level tts_engine in server.py."""
    with patch("app.server.tts_engine") as mock:
        mock.synthesize = AsyncMock()
        yield mock


@pytest.fixture()
async def client(mock_retriever):
    """Async test client that skips the real lifespan (Moss init)."""
    from app.server import app

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as c:
        yield c
