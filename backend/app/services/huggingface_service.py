import re

import httpx

from app.models.huggingface import HfGgufFile, HfModelSummary
from app.utils.gguf_meta import params_from_repo_id, quant_from_filename

HF_API_BASE = "https://huggingface.co/api"

_SPLIT_SHARD_PATTERN = re.compile(r"-\d+-of-\d+\.gguf$", re.IGNORECASE)

# llama.rn only runs causal-LM chat/completion models - not embedding models,
# which use a different (non-generative) inference path.
_NON_CHAT_PIPELINE_TAGS = {"feature-extraction", "sentence-similarity"}


async def search_models(query: str, limit: int = 25) -> list[HfModelSummary]:
    async with httpx.AsyncClient(timeout=10.0) as client:
        resp = await client.get(
            f"{HF_API_BASE}/models",
            # Over-fetch since embedding models get filtered out below and we
            # still want to return close to `limit` results.
            params={"search": query, "filter": "gguf", "sort": "downloads", "direction": "-1", "limit": limit * 2},
        )
        resp.raise_for_status()

        results: list[HfModelSummary] = []
        for item in resp.json():
            pipeline_tag = item.get("pipeline_tag")
            if pipeline_tag in _NON_CHAT_PIPELINE_TAGS:
                continue

            repo_id = item["id"]
            results.append(
                HfModelSummary(
                    repo_id=repo_id,
                    url=f"https://huggingface.co/{repo_id}",
                    downloads=item.get("downloads", 0),
                    likes=item.get("likes", 0),
                    pipeline_tag=pipeline_tag,
                    library_name=item.get("library_name"),
                    params=params_from_repo_id(repo_id),
                    tags=item.get("tags", []),
                )
            )
            if len(results) >= limit:
                break
        return results


async def list_gguf_files(repo_id: str) -> list[HfGgufFile]:
    """Lists single-file GGUF variants for a repo (filtering out split shards
    like `-00001-of-00002.gguf`, which would need multi-part download/merge
    support the app doesn't have). Compatibility with the requesting phone's
    RAM is computed client-side now, since this backend has no device to
    check against."""
    async with httpx.AsyncClient(timeout=10.0) as client:
        resp = await client.get(f"{HF_API_BASE}/models/{repo_id}/tree/main")
        resp.raise_for_status()
        entries = resp.json()

    files: list[HfGgufFile] = []
    for entry in entries:
        path = entry.get("path", "")
        if not path.endswith(".gguf") or _SPLIT_SHARD_PATTERN.search(path):
            continue
        files.append(HfGgufFile(filename=path, size_bytes=entry.get("size", 0), quant=quant_from_filename(path)))
    return files
