import asyncio
import re
import shutil
import time
from dataclasses import asdict

import httpx

from app.config import settings
from app.core.ring_buffer import Broadcaster
from app.models.huggingface import CompatibilityInfo, HfGgufFile, HfModelSummary
from app.services import compatibility_service
from app.utils.gguf_meta import quant_from_filename

HF_API_BASE = "https://huggingface.co/api"
HF_RESOLVE_BASE = "https://huggingface.co"

_SPLIT_SHARD_PATTERN = re.compile(r"-\d+-of-\d+\.gguf$", re.IGNORECASE)
_CHUNK_SIZE = 1024 * 1024
_PROGRESS_INTERVAL_SECONDS = 0.5

download_broadcaster = Broadcaster(maxlen=200)
_cancel_events: dict[str, asyncio.Event] = {}


async def search_models(query: str, limit: int = 25) -> list[HfModelSummary]:
    async with httpx.AsyncClient(timeout=10.0) as client:
        resp = await client.get(
            f"{HF_API_BASE}/models",
            params={"search": query, "filter": "gguf", "sort": "downloads", "direction": "-1", "limit": limit},
        )
        resp.raise_for_status()
        return [
            HfModelSummary(repo_id=item["id"], downloads=item.get("downloads", 0), likes=item.get("likes", 0))
            for item in resp.json()
        ]


async def list_gguf_files(repo_id: str, serial: str | None) -> list[HfGgufFile]:
    async with httpx.AsyncClient(timeout=10.0) as client:
        resp = await client.get(f"{HF_API_BASE}/models/{repo_id}/tree/main")
        resp.raise_for_status()
        entries = resp.json()

    memory = await compatibility_service.get_device_memory(serial)

    files: list[HfGgufFile] = []
    for entry in entries:
        path = entry.get("path", "")
        if not path.endswith(".gguf") or _SPLIT_SHARD_PATTERN.search(path):
            continue
        size_bytes = entry.get("size", 0)
        compat = compatibility_service.build_compatibility(size_bytes, memory)
        files.append(
            HfGgufFile(
                filename=path,
                size_bytes=size_bytes,
                quant=quant_from_filename(path),
                compatibility=CompatibilityInfo(**asdict(compat)),
            )
        )
    return files


def safe_download_path(filename: str):
    if "/" in filename or "\\" in filename or ".." in filename:
        raise ValueError(f"invalid filename: {filename!r}")
    path = (settings.models_dir / filename).resolve()
    if path.parent != settings.models_dir.resolve():
        raise ValueError(f"invalid filename: {filename!r}")
    return path


def cancel_download(job_id: str) -> None:
    event = _cancel_events.get(job_id)
    if event is not None:
        event.set()


async def download_file(repo_id: str, filename: str, job_id: str, serial: str | None) -> None:
    dest_path = safe_download_path(filename)
    url = f"{HF_RESOLVE_BASE}/{repo_id}/resolve/main/{filename}"
    cancel_event = asyncio.Event()
    _cancel_events[job_id] = cancel_event

    try:
        async with httpx.AsyncClient(timeout=None, follow_redirects=True) as client:
            async with client.stream("GET", url) as response:
                if response.status_code != 200:
                    await download_broadcaster.publish(
                        job_id, {"type": "error", "message": f"download failed: HTTP {response.status_code}"}
                    )
                    return

                total_bytes = int(response.headers.get("content-length", 0))
                if shutil.disk_usage(settings.models_dir).free < total_bytes:
                    await download_broadcaster.publish(
                        job_id, {"type": "error", "message": "not enough free disk space on this machine"}
                    )
                    return

                downloaded = 0
                last_emit = 0.0
                cancelled = False
                with dest_path.open("wb") as f:
                    async for chunk in response.aiter_bytes(_CHUNK_SIZE):
                        if cancel_event.is_set():
                            cancelled = True
                            break

                        f.write(chunk)
                        downloaded += len(chunk)

                        now = time.monotonic()
                        if now - last_emit >= _PROGRESS_INTERVAL_SECONDS:
                            last_emit = now
                            await download_broadcaster.publish(
                                job_id,
                                {"type": "progress", "downloaded_bytes": downloaded, "total_bytes": total_bytes},
                            )

        if cancelled:
            dest_path.unlink(missing_ok=True)
            await download_broadcaster.publish(job_id, {"type": "cancelled"})
            return

        await download_broadcaster.publish(
            job_id, {"type": "done", "downloaded_bytes": downloaded, "total_bytes": total_bytes}
        )
    except httpx.HTTPError as exc:
        dest_path.unlink(missing_ok=True)
        await download_broadcaster.publish(job_id, {"type": "error", "message": str(exc)})
    finally:
        _cancel_events.pop(job_id, None)
