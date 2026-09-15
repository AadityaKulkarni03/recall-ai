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

import time
from dataclasses import dataclass

from groq import Groq

from . import config
from .retriever import Passage

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
2. Every factual claim MUST include a citation in the format: (Speaker, timestamp).
3. If the answer is not in the excerpts, respond: "This was not discussed in the \
retrieved excerpts. Try rephrasing your question or providing more context."
4. Keep answers concise — ideally 1-3 sentences.
5. If multiple excerpts contribute to the answer, cite each one.
6. Use the excerpt number [N] when referencing specific passages.

## Output Format
Answer: <your answer with inline citations>
Confidence: <high|medium|low> based on how directly the excerpts answer the question.

## Few-Shot Examples

### Example 1
Excerpts:
[1] Alice @ 30s: The Q3 budget is 50 thousand dollars and needs board approval.
[2] Bob @ 45s: We should finalize the budget by end of this week.

Question: What is the Q3 budget?

Answer: The Q3 budget is $50,000 and requires board approval (Alice, 30s) [1]. \
Bob suggested finalizing it by end of this week (Bob, 45s) [2].
Confidence: high

### Example 2
Excerpts:
[1] Jane @ 120s: The marketing team wants to launch the campaign in October.
[2] Jane @ 180s: We need two more engineers for the backend team.

Question: When is the product launch date?

Answer: This was not discussed in the retrieved excerpts. The marketing campaign \
launch was mentioned for October (Jane, 120s) [1], but no specific product launch \
date was discussed. Try rephrasing your question or providing more context.
Confidence: low"""


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
        response = self._client.chat.completions.create(
            model=model,
            messages=[
                {"role": "system", "content": SYSTEM_PROMPT},
                {"role": "user", "content": user_message},
            ],
            max_tokens=600,
            temperature=0.2,
        )
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
