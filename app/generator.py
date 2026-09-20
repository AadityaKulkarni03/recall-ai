"""Optional Groq LLM answer generation — RAG over retrieved passages.

Uses the CRISPE prompt framework:
- Capacity: Meeting assistant with retrieval-grounded answering
- Role: Expert meeting analyst who only uses provided transcript excerpts
- Insight: Must cite speaker and timestamp for every factual claim
- Statement: Concise, direct answers with structured citation format
- Personality: Professional, precise, honest about gaps
- Experiment: Few-shot examples to enforce consistent output format
"""

from __future__ import annotations

import asyncio
import logging
import time
from dataclasses import dataclass

from groq import Groq

from . import config
from .retriever import Passage

logger = logging.getLogger("recall.generator")

# ── CRISPE System Prompt ────────────────────────────────────────

SYSTEM_PROMPT = """\
## Capacity
You are a real-time meeting assistant powered by Moss semantic retrieval. \
You answer questions about an ongoing or recorded conversation using ONLY the \
transcript excerpts retrieved below.

## Role
Expert meeting analyst. You extract precise answers from retrieved passages, \
cite your sources with speaker name and timestamp, and clearly state when \
the answer cannot be found in the provided context.

## Rules
1. Answer based ONLY on the provided transcript excerpts. Never invent information.
2. Do NOT include speaker names, timestamps, or excerpt numbers in your answer.
3. Do NOT add a "Sources" line or any attribution. Just give the answer.
4. If the answer is not in the excerpts, respond: "This was not discussed in the \
retrieved excerpts. Try rephrasing your question or providing more context."
5. Keep answers concise — ideally 1-3 sentences.
6. If multiple excerpts contribute to the answer, synthesize them into a single clear response.
7. Do NOT output "Answer:" or "Confidence:" labels. Just write the answer directly.

## Few-Shot Examples

### Example 1
Excerpts:
[1] Alice @ 30s: The Q3 budget is 50 thousand dollars and needs board approval.
[2] Bob @ 45s: We should finalize the budget by end of this week.

Question: What is the Q3 budget?

The Q3 budget is $50,000 and requires board approval. The suggestion is to \
finalize it by end of this week.

### Example 2
Excerpts:
[1] Jane @ 120s: The marketing team wants to launch the campaign in October.
[2] Jane @ 180s: We need two more engineers for the backend team.

Question: When is the product launch date?

This was not discussed in the retrieved excerpts. The marketing campaign \
launch was mentioned for October, but no specific product launch date was discussed. \
Try rephrasing your question or providing more context."""


@dataclass
class GeneratedAnswer:
    """LLM-generated answer with metadata."""

    answer: str
    model: str
    generation_ms: float
    confidence: str


class Generator:
    """Wraps the Groq chat API for optional RAG answer generation."""

    def __init__(self) -> None:
        self._client = Groq(api_key=config.GROQ_API_KEY)

    def _build_context(self, passages: list[Passage]) -> str:
        """Format retrieved passages into a numbered context block."""
        lines = []
        for i, p in enumerate(passages, 1):
            ts = f"{p.timestamp:.0f}s" if p.timestamp else "?"
            lines.append(f"[{i}] {p.speaker} @ {ts}: {p.text}")
        return "\n".join(lines)

    def _call_llm(self, model: str, user_message: str):
        """Synchronous Groq chat call — run in a thread to avoid blocking."""
        return self._client.chat.completions.create(
            model=model,
            messages=[
                {"role": "system", "content": SYSTEM_PROMPT},
                {"role": "user", "content": user_message},
            ],
            max_tokens=600,
            temperature=0.2,
        )

    async def generate(
        self,
        question: str,
        passages: list[Passage],
        model: str | None = None,
    ) -> GeneratedAnswer:
        """Generate an answer grounded in the retrieved passages."""
        model = model or config.GROQ_LLM_MODEL
        context = self._build_context(passages)

        user_message = (
            f"Excerpts:\n{context}\n\n"
            f"Question: {question}"
        )

        start = time.perf_counter()
        response = await asyncio.to_thread(self._call_llm, model, user_message)
        elapsed_ms = (time.perf_counter() - start) * 1000

        raw = response.choices[0].message.content.strip()

        # Parse confidence from output if present
        answer = raw
        confidence = "medium"
        if "\nConfidence:" in raw:
            parts = raw.rsplit("\nConfidence:", 1)
            answer = parts[0].strip()
            confidence = parts[1].strip().lower()
            # Strip "Answer: " prefix if present
            if answer.startswith("Answer:"):
                answer = answer[len("Answer:"):].strip()
        elif raw.startswith("Answer:"):
            answer = raw[len("Answer:"):].strip()

        return GeneratedAnswer(
            answer=answer,
            model=response.model,
            generation_ms=round(elapsed_ms, 2),
            confidence=confidence,
        )

    def _stream_llm(self, model: str, messages: list[dict]):
        """Synchronous streaming Groq chat call — yields chunks."""
        return self._client.chat.completions.create(
            model=model,
            messages=messages,
            max_tokens=600,
            temperature=0.2,
            stream=True,
        )

    async def generate_stream(
        self,
        question: str,
        passages: list[Passage],
        model: str | None = None,
    ):
        """Stream an answer token by token. Yields (token, done) tuples."""
        model = model or config.GROQ_LLM_MODEL
        context = self._build_context(passages)
        user_message = f"Excerpts:\n{context}\n\nQuestion: {question}"
        messages = [
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user", "content": user_message},
        ]

        stream = await asyncio.to_thread(self._stream_llm, model, messages)

        full_text = ""
        for chunk in stream:
            delta = chunk.choices[0].delta
            if delta.content:
                full_text += delta.content
                yield delta.content
            await asyncio.sleep(0)  # yield to event loop so SSE flushes
        logger.info("stream-generate: completed, %d chars", len(full_text))

    async def summarize(
        self,
        passages: list[Passage],
        model: str | None = None,
    ) -> GeneratedAnswer:
        """Generate a full meeting summary from all passages."""
        model = model or config.GROQ_LLM_MODEL
        context = self._build_context(passages)
        user_message = f"Meeting transcript excerpts:\n{context}"

        messages = [
            {"role": "system", "content": SUMMARY_PROMPT},
            {"role": "user", "content": user_message},
        ]

        start = time.perf_counter()
        response = await asyncio.to_thread(
            lambda: self._client.chat.completions.create(
                model=model, messages=messages, max_tokens=1000, temperature=0.3,
            )
        )
        elapsed_ms = (time.perf_counter() - start) * 1000

        raw = response.choices[0].message.content.strip()
        return GeneratedAnswer(
            answer=raw,
            model=response.model,
            generation_ms=round(elapsed_ms, 2),
            confidence="high",
        )

    async def summarize_stream(
        self,
        passages: list[Passage],
        model: str | None = None,
    ):
        """Stream a meeting summary token by token."""
        model = model or config.GROQ_LLM_MODEL
        context = self._build_context(passages)
        user_message = f"Meeting transcript excerpts:\n{context}"

        messages = [
            {"role": "system", "content": SUMMARY_PROMPT},
            {"role": "user", "content": user_message},
        ]

        stream = await asyncio.to_thread(
            lambda: self._client.chat.completions.create(
                model=model, messages=messages, max_tokens=1000, temperature=0.3, stream=True,
            )
        )

        full_text = ""
        for chunk in stream:
            delta = chunk.choices[0].delta
            if delta.content:
                full_text += delta.content
                yield delta.content
            await asyncio.sleep(0)  # yield to event loop so SSE flushes
        logger.info("stream-summarize: completed, %d chars", len(full_text))


# ── Summary Prompt ──────────────────────────────────────────────

SUMMARY_PROMPT = """\
You are a meeting summarization assistant. Given ALL the transcript excerpts \
from a meeting, produce a structured summary.

## Rules
1. Base your summary ONLY on the provided excerpts.
2. Do NOT include speaker names, timestamps, or excerpt numbers.
3. Be concise and specific — no filler.

## Output Format
**Key Topics**
- Topic 1
- Topic 2

**Decisions Made**
- Decision 1
- Decision 2 (or "None identified" if none)

**Action Items**
- Action item 1
- Action item 2 (or "None identified" if none)

**Summary**
A 2-4 sentence overview of the meeting."""
