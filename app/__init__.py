"""Recall AI — real-time meeting memory with sub-10ms semantic search."""

import logging
import sys

# ── Logging setup ───────────────────────────────────────────────
# Configure once at package import so all modules share the same format.

_handler = logging.StreamHandler(sys.stdout)
_handler.setFormatter(
    logging.Formatter(
        fmt="%(asctime)s | %(levelname)-7s | %(name)s | %(message)s",
        datefmt="%H:%M:%S",
    )
)

_root = logging.getLogger("recall")
_root.setLevel(logging.INFO)
_root.addHandler(_handler)
