"""Moss session manager — real-time indexing and <10ms semantic retrieval."""

from __future__ import annotations

import logging
import time
import uuid
from dataclasses import dataclass, field
from typing import Optional

from moss import MossClient, QueryOptions, DocumentInfo

from . import config

logger = logging.getLogger("recall.retriever")


@dataclass
class Utterance:
    """A single chunk of conversation stored in the index."""

    id: str
    text: str
    speaker: str
    timestamp: float  # seconds from start of session
    metadata: dict = field(default_factory=dict)


@dataclass
class RetrievalResult:
    """What comes back from a query."""

    query: str
    passages: list[Passage]
    retrieval_ms: float


@dataclass
class Passage:
    """A single retrieved passage."""

    id: str
    text: str
    score: float
    speaker: str
    timestamp: float


class Retriever:
    """Wraps a Moss session for a single meeting.

    Call ``init()`` once at startup, then ``add_utterance`` as text arrives
    and ``query`` whenever the user asks a question.
    """

    def __init__(self) -> None:
        self._client: Optional[MossClient] = None
        self._session = None
        self._utterances: list[Utterance] = []
        self._counter: int = 0
        self._session_id: str = ""

    async def init(self) -> None:
        """Create the Moss client and open a fresh session."""
        self._client = MossClient(config.MOSS_PROJECT_ID, config.MOSS_PROJECT_KEY)
        self._session_id = f"recall-{uuid.uuid4().hex[:8]}"
        self._session = await self._client.session(self._session_id)
        self._utterances = []
        self._counter = 0
        logger.info("Session initialized (id=%s)", self._session_id)

    async def reset(self) -> None:
        """Tear down the current session and start fresh."""
        await self.init()

    async def add_utterance(
        self,
        text: str,
        speaker: str = "Speaker",
        timestamp: float = 0.0,
    ) -> Utterance:
        """Index a new piece of conversation text."""
        self._counter += 1
        doc_id = f"utt-{self._counter}"

        utterance = Utterance(
            id=doc_id,
            text=text,
            speaker=speaker,
            timestamp=timestamp,
            metadata={"speaker": speaker, "timestamp": str(timestamp)},
        )

        doc = DocumentInfo(
            id=doc_id,
            text=text,
            metadata=utterance.metadata,
        )
        await self._session.add_docs([doc])
        self._utterances.append(utterance)
        return utterance

    async def add_chunks(
        self,
        chunks: list[dict],
    ) -> list[Utterance]:
        """Batch-index multiple chunks.

        Each dict should have at least ``text``; optionally ``speaker``
        and ``timestamp``.
        """
        results = []
        for chunk in chunks:
            utt = await self.add_utterance(
                text=chunk["text"],
                speaker=chunk.get("speaker", "Speaker"),
                timestamp=chunk.get("timestamp", 0.0),
            )
            results.append(utt)
        return results

    async def query(self, question: str, top_k: int | None = None) -> RetrievalResult:
        """Semantic search over the indexed conversation."""
        k = top_k or config.TOP_K
        start = time.perf_counter()
        result = await self._session.query(question, QueryOptions(top_k=k))
        elapsed_ms = (time.perf_counter() - start) * 1000

        passages = []
        for doc in result.docs:
            meta = doc.metadata or {}
            passages.append(
                Passage(
                    id=doc.id,
                    text=doc.text,
                    score=doc.score,
                    speaker=meta.get("speaker", "Unknown"),
                    timestamp=float(meta.get("timestamp", 0)),
                )
            )

        return RetrievalResult(
            query=question,
            passages=passages,
            retrieval_ms=round(elapsed_ms, 2),
        )

    @property
    def utterance_count(self) -> int:
        return len(self._utterances)

    @property
    def utterances(self) -> list[Utterance]:
        return list(self._utterances)
