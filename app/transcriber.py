"""Groq Whisper STT wrapper — transcribe audio files and live audio chunks."""

from __future__ import annotations

import asyncio
import io
import logging
import tempfile
from dataclasses import dataclass
from pathlib import Path

from groq import Groq

from . import config

logger = logging.getLogger("recall.transcriber")


@dataclass
class TranscriptSegment:
    """A single segment returned by Whisper."""

    text: str
    start: float  # seconds
    end: float  # seconds


@dataclass
class TranscriptResult:
    """Full transcription output."""

    text: str  # joined full text
    segments: list[TranscriptSegment]
    language: str


class Transcriber:
    """Wraps the Groq Whisper API for speech-to-text."""

    def __init__(self) -> None:
        self._client = Groq(api_key=config.GROQ_API_KEY)

    async def transcribe_file(self, file_path: str | Path) -> TranscriptResult:
        """Transcribe an audio file on disk.

        Supports: mp3, mp4, m4a, wav, webm, ogg, flac.
        """
        path = Path(file_path)
        with open(path, "rb") as f:
            return await asyncio.to_thread(self._transcribe, f, path.name)

    async def transcribe_bytes(
        self,
        audio_bytes: bytes,
        filename: str = "audio.webm",
    ) -> TranscriptResult:
        """Transcribe raw audio bytes (e.g. from a WebSocket chunk or upload)."""
        buf = io.BytesIO(audio_bytes)
        buf.name = filename
        return await asyncio.to_thread(self._transcribe, buf, filename)

    def _transcribe(self, file_obj, filename: str) -> TranscriptResult:
        """Call Groq Whisper and parse the response."""
        response = self._client.audio.transcriptions.create(
            model=config.GROQ_STT_MODEL,
            file=(filename, file_obj),
            response_format="verbose_json",
            language="en",
        )

        segments = []
        if hasattr(response, "segments") and response.segments:
            for seg in response.segments:
                segments.append(
                    TranscriptSegment(
                        text=seg.get("text", seg.text if hasattr(seg, "text") else "").strip(),
                        start=seg.get("start", getattr(seg, "start", 0.0)),
                        end=seg.get("end", getattr(seg, "end", 0.0)),
                    )
                )

        full_text = response.text.strip() if response.text else ""
        language = getattr(response, "language", "en") or "en"

        # If no segments returned, create one from the full text
        if not segments and full_text:
            segments = [TranscriptSegment(text=full_text, start=0.0, end=0.0)]

        return TranscriptResult(
            text=full_text,
            segments=segments,
            language=language,
        )

    def segments_to_chunks(
        self,
        segments: list[TranscriptSegment],
        speaker: str = "Speaker",
    ) -> list[dict]:
        """Convert transcript segments into chunk dicts ready for the retriever."""
        return [
            {
                "text": seg.text,
                "speaker": speaker,
                "timestamp": seg.start,
            }
            for seg in segments
            if seg.text.strip()
        ]
