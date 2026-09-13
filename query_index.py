"""Query a Moss index.

Credentials are read from the environment (MOSS_PROJECT_ID / MOSS_PROJECT_KEY)
so they never live in source control. Run via ./run.sh, or export them yourself.

Usage:
    ./run.sh "some query"           # single query
    ./run.sh --interactive          # REPL mode — load once, query many times
    ./run.sh                        # single query with default prompt

The script tries to load the index locally for on-device search. If that fails
(e.g. model download unavailable), it falls back to the cloud query API.
"""

import asyncio
import os
import sys

from moss import MossClient, QueryOptions

INDEX_NAME = "demo-customer_faqs"
DEFAULT_QUERY = "How do I return a damaged product?"
TOP_K = 5


def print_results(result, mode: str) -> None:
    """Pretty-print a SearchResult."""
    print(f"\nquery: {result.query}")
    print(f"index: {result.index_name}  ({result.time_taken_ms} ms, {mode})")
    print(f"hits:  {len(result.docs)}\n")

    for rank, doc in enumerate(result.docs, start=1):
        print(f"{rank}. [{doc.score:.4f}] {doc.id}")
        print(f"   {doc.text}")
        if doc.metadata:
            print(f"   metadata: {doc.metadata}")
        print()


async def main() -> int:
    project_id = os.getenv("MOSS_PROJECT_ID")
    project_key = os.getenv("MOSS_PROJECT_KEY")
    if not project_id or not project_key:
        print(
            "MOSS_PROJECT_ID and MOSS_PROJECT_KEY must be set in the environment.",
            file=sys.stderr,
        )
        return 1

    # Check for --interactive flag
    args = sys.argv[1:]
    interactive = "--interactive" in args or "-i" in args
    args = [a for a in args if a not in ("--interactive", "-i")]

    client = MossClient(project_id, project_key)

    # Load index locally; fall back to cloud if unavailable.
    local = False
    try:
        print("Loading index locally...", file=sys.stderr)
        await client.load_index(INDEX_NAME)
        local = True
        print("Index loaded — using on-device search.", file=sys.stderr)
    except Exception as e:
        print(f"Local load failed ({e}), falling back to cloud query.", file=sys.stderr)

    mode = "local" if local else "cloud"

    if interactive:
        print(f"\nInteractive mode — type a query and press Enter. /exit to quit.\n")
        while True:
            try:
                query_text = input("query> ").strip()
            except (EOFError, KeyboardInterrupt):
                print()
                break
            if not query_text or query_text.lower() == "/exit":
                break
            try:
                result = await client.query(INDEX_NAME, query_text, QueryOptions(top_k=TOP_K))
                print_results(result, mode)
            except Exception as e:
                print(f"Query failed: {e}", file=sys.stderr)
    else:
        query_text = " ".join(args) or DEFAULT_QUERY
        try:
            result = await client.query(INDEX_NAME, query_text, QueryOptions(top_k=TOP_K))
            print_results(result, mode)
        except Exception as e:
            print(f"\nQuery failed: {e}", file=sys.stderr)
            if not local:
                print(
                    "Both local and cloud paths are unavailable. "
                    "The Moss service may be experiencing an outage — try again later.",
                    file=sys.stderr,
                )
            return 1

    return 0


if __name__ == "__main__":
    raise SystemExit(asyncio.run(main()))
