"""Does an SDK-built index get a real artifact identity, unlike a service-built one?

Creates a throwaway index, loads it, queries it locally, prints the model ref,
then deletes it. Isolates whether the "no exact artifact identity" failure is
specific to service/portal-built indexes.
"""

import asyncio
import os

from moss import DocumentInfo, MossClient, QueryOptions

import sys

MODEL = sys.argv[1] if len(sys.argv) > 1 else "moss-minilm"
TEST_INDEX = f"kiro-artifact-test-{MODEL}"

DOCS = [
    DocumentInfo(id="doc1", text="How do I track my order? Log into your account.",
                 metadata={"category": "shipping"}),
    DocumentInfo(id="doc2", text="What is your return policy? We offer a 30-day return policy.",
                 metadata={"category": "returns"}),
    DocumentInfo(id="doc3", text="How can I change my shipping address? Contact support.",
                 metadata={"category": "support"}),
]


async def main() -> None:
    client = MossClient(os.environ["MOSS_PROJECT_ID"], os.environ["MOSS_PROJECT_KEY"])

    try:
        print(f"creating index via SDK ({MODEL})...")
        res = await client.create_index(TEST_INDEX, DOCS, MODEL)
        print(f"  built: job={res.job_id} docs={res.doc_count}")

        info = await client.get_index(TEST_INDEX)
        print(f"  model ref: {info.model.id}@{info.model.version}   status={info.status}")

        print("loading + querying locally...")
        await client.load_index(TEST_INDEX)
        result = await client.query(
            TEST_INDEX, "How do I return a damaged product?", QueryOptions(top_k=3, alpha=0.6)
        )
        print(f"  LOCAL QUERY OK -> {len(result.docs)} docs, {result.time_taken_ms} ms")
        for d in result.docs:
            print(f"    [{d.score:.4f}] {d.id}: {d.text[:60]}")

    except Exception as e:
        print(f"  FAILED {type(e).__name__}: {e}")

    finally:
        try:
            await client.unload_index(TEST_INDEX)
        except Exception:
            pass
        try:
            deleted = await client.delete_index(TEST_INDEX)
            print(f"cleanup: deleted throwaway index -> {deleted}")
        except Exception as e:
            print(f"cleanup FAILED, remove '{TEST_INDEX}' manually: {e}")


asyncio.run(main())
