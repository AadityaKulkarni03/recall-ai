"""Capture exact evidence for both Moss failure paths, for a bug report."""

import asyncio
import datetime
import os

import httpx

import moss
from moss import MossClient, QueryOptions

INDEX = "demo-customer_faqs"
QUERY = "How do I return a damaged product?"


async def main() -> None:
    import importlib.metadata as md

    print(f"utc:            {datetime.datetime.now(datetime.UTC).isoformat()}")
    print(f"moss dist:      {md.version('moss')}")
    print(f"moss.__version__: {moss.__version__}   <-- disagrees with dist")
    print(f"core dist:      {md.version('inferedge-moss-core')}")

    client = MossClient(os.environ["MOSS_PROJECT_ID"], os.environ["MOSS_PROJECT_KEY"])

    print("\n=== 1. control plane (management API) ===")
    try:
        info = await client.get_index(INDEX)
        print(f"  get_index OK -> status={info.status} docs={info.doc_count} "
              f"model={info.model.id}@{info.model.version}")
    except Exception as e:
        print(f"  get_index FAILED {type(e).__name__}: {e}")

    print("\n=== 2. cloud query endpoint (raw HTTP) ===")
    url = os.getenv("MOSS_QUERY_URL", "https://service.usemoss.dev/query")
    print(f"  POST {url}")
    for i in range(1, 4):
        try:
            r = httpx.post(
                url,
                json={
                    "query": QUERY,
                    "indexName": INDEX,
                    "projectId": os.environ["MOSS_PROJECT_ID"],
                    "projectKey": os.environ["MOSS_PROJECT_KEY"],
                    "topK": 5,
                },
                timeout=60.0,
            )
            server = r.headers.get("server", "?")
            first = " ".join(r.text.split())[:120]
            print(f"  attempt {i}: {r.status_code} server={server} body={first}")
        except Exception as e:
            print(f"  attempt {i}: {type(e).__name__}: {e}")

    print("\n=== 3. on-device path (after load_index) ===")
    try:
        loaded = await client.load_index(INDEX)
        print(f"  load_index OK -> {loaded}")
    except Exception as e:
        print(f"  load_index FAILED {type(e).__name__}: {e}")
        return
    try:
        await client.query(INDEX, QUERY, QueryOptions(top_k=5))
        print("  local query OK")
    except Exception as e:
        print(f"  local query FAILED {type(e).__name__}: {e}")


asyncio.run(main())
