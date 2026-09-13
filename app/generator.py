"""Optional Groq LLM answer generation — RAG over retrieved passages."""

from __future__ import annotations

import time
from dataclasses import dataclass

from groq import Groq

from . import config
from .retriever import Passage

SYSTEM_PROMPT = """\
You are a helpful meeting assistant. Answer the user's question based ONLY on \
the meeting transcript excerpts provided below. Be concise and direct. If the \
answer is not in the excerpts, say so honestly. Cite the speaker name and \
approximate timestamp when referencing a specific statement."""


@dataclass
class GeneratedAnswer:
    """LLM-generated answer with metadata."""

    answer: str
    model: str
    generation_ms: float


class Generator:
    """Wraps the Groq chat API for optional RAG answer generation."""

    def __init__(self) -> None:
        self._client = Groq(api_key=config.GROQ_API_KEY)

    def _build_context(self, passages: list[Passage]) -> str:
        """Format retrieved passages into a context block for the LLM."""
        lines = []
        for i, p in enumerate(passages, 1):
            ts = f"{p.timestamp:.0f}s" if p.timestamp else "?"
            lines.append(f"[{i}] {p.speaker} @ {ts}: {p.text}")
        return "\n".join(lines)

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
            f"Meeting transcript excerpts:\n{context}\n\n"
            f"Question: {question}"
        )

        start = time.perf_counter()
        response = self._client.chat.completions.create(
            model=model,
            messages=[
                {"role": "system", "content": SYSTEM_PROMPT},
                {"role": "user", "content": user_message},
            ],
            max_tokens=300,
            temperature=0.3,
        )
        elapsed_ms = (time.perf_counter() - start) * 1000

        answer = response.choices[0].message.content.strip()

        return GeneratedAnswer(
            answer=answer,
            model=response.model,
            generation_ms=round(elapsed_ms, 2),
        )
