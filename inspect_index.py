import asyncio
import os

from moss import MossClient

INDEX_NAME = "demo-customer_faqs"


async def main() -> None:
    client = MossClient(os.environ["MOSS_PROJECT_ID"], os.environ["MOSS_PROJECT_KEY"])

    indexes = await client.list_indexes()
    print(f"indexes in project: {[i.name for i in indexes]}\n")

    info = await client.get_index(INDEX_NAME)
    print(f"name:      {info.name}")
    print(f"id:        {info.id}")
    print(f"version:   {info.version}")
    print(f"status:    {info.status}")
    print(f"doc_count: {info.doc_count}")
    print(f"model.id:  {info.model.id}")
    print(f"model.ver: {info.model.version!r}")


asyncio.run(main())
