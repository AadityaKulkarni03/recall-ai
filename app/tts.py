"""Text-to-Speech via Groq Orpheus — completes the voice-to-voice loop."""

from __future__ import annotations

import asyncio
import logging
import time
from dataclasses import dataclass

from groq import Groq

from . import config

logger = logging.getLogger("recall.tts")

TTS_MODEL = "canopylabs/orpheus-v1-english"
TTS_VOICE = "diana"  # Options: autumn, diana, hannah, austin, daniel, troy


@dataclass
class TTSResult:
    """TTS output with metadata."""

    audio_bytes: bytes
    content_type: str
    generation_ms: float


class TextToSpeech:
    """Wraps Groq's TTS API for voice output."""

    def __init__(self) -> None:
        self._client = Groq(api_key=config.GROQ_API_KEY)

    def _synthesize_sync(self, text: str, voice: str):
        """Synchronous Groq TTS call — run in a thread to avoid blocking."""
        response = self._client.audio.speech.create(
            model=TTS_MODEL,
            input=text,
            voice=voice,
            response_format="wav",
        )
        return response.read()

    async def synthesize(
        self,
        text: str,
        voice: str | None = None,
    ) -> TTSResult:
        """Convert text to spoken audio.

        Returns WAV audio bytes.
        """
        start = time.perf_counter()
        audio_bytes = await asyncio.to_thread(
            self._synthesize_sync, text, voice or TTS_VOICE
        )
        elapsed_ms = (time.perf_counter() - start) * 1000

        return TTSResult(
            audio_bytes=audio_bytes,
            content_type="audio/wav",
            generation_ms=round(elapsed_ms, 2),
        )
