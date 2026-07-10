import asyncio
import json
import time
import uuid

import httpx
from sqlmodel import Session

from app.config import settings
from app.core.ring_buffer import Broadcaster
from app.db import engine
from app.db_models.project import Project
from app.services import project_service, termux_service
from app.services.adb_service import adb_service
from app.utils.shell_quote import build_remote_command

frame_broadcaster = Broadcaster(maxlen=2000)

_LLAMA_SERVER_CMD = (
    "cd ~/llama.cpp && nohup ./build/bin/llama-server -m {model_path} "
    "--host 0.0.0.0 --port {port} -c {ctx} > ~/llama-server.log 2>&1 &"
)


async def _server_reachable() -> bool:
    try:
        async with httpx.AsyncClient(timeout=2.0) as client:
            resp = await client.get(f"http://127.0.0.1:{settings.llama_server_port}/v1/models")
            return resp.status_code == 200
    except httpx.HTTPError:
        return False


async def ensure_server_running(project: Project, serial: str | None = None) -> None:
    if not project.model_filename:
        raise ValueError("project has no model assigned")

    forward_list = await adb_service.forward_list(serial=serial)
    already_forwarded = any(f"tcp:{settings.llama_server_port}" in line for line in forward_list.stdout_lines)
    if not already_forwarded:
        await adb_service.forward(settings.llama_server_port, settings.llama_server_port, serial=serial)

    if await _server_reachable():
        return

    model_path = f"{settings.remote_download_dir}/{project.model_filename}"
    cmd = build_remote_command(
        "bash", "-lc",
        _LLAMA_SERVER_CMD.format(model_path=model_path, port=settings.llama_server_port, ctx=project.context_length),
    )
    await termux_service.run_command(cmd, serial, category="CPU")

    for _ in range(30):
        if await _server_reachable():
            return
        await asyncio.sleep(1)
    raise RuntimeError("llama-server did not become reachable within 30s")


async def run_inference(project: Project, prompt: str) -> str:
    """Spawns the streaming completion as a detached background task -- it
    must not depend on the caller's (request-scoped) DB session, since that
    session is closed as soon as the HTTP handler returns the job_id."""
    job_id = str(uuid.uuid4())
    asyncio.create_task(_stream_completion(project.id, project, prompt, job_id))
    return job_id


async def _stream_completion(project_id: str, project: Project, prompt: str, job_id: str) -> None:
    start = time.monotonic()
    tokens = 0
    full_text = ""
    payload = {
        "model": project.model_filename,
        "messages": [{"role": "user", "content": prompt}],
        "temperature": project.temperature,
        "top_p": project.top_p,
        "top_k": project.top_k,
        "max_tokens": project.max_tokens,
        "stream": True,
    }
    try:
        async with httpx.AsyncClient(timeout=None) as client:
            async with client.stream(
                "POST",
                f"http://127.0.0.1:{settings.llama_server_port}/v1/chat/completions",
                json=payload,
            ) as response:
                async for line in response.aiter_lines():
                    if not line.startswith("data:"):
                        continue
                    data = line[len("data:"):].strip()
                    if data == "[DONE]":
                        break
                    try:
                        chunk = json.loads(data)
                        delta = chunk["choices"][0]["delta"].get("content", "")
                    except (KeyError, IndexError, ValueError):
                        continue
                    if delta:
                        tokens += 1
                        full_text += delta
                        await frame_broadcaster.publish(job_id, {"type": "token", "text": delta})
    except httpx.HTTPError as exc:
        await frame_broadcaster.publish(job_id, {"type": "error", "message": str(exc)})
        return

    tok_per_sec = tokens / max(time.monotonic() - start, 1e-6)
    with Session(engine) as session:
        project_service.add_history_entry(session, project_id, prompt, full_text, tokens, tok_per_sec)
    await frame_broadcaster.publish(
        job_id, {"type": "done", "tokens": tokens, "tok_per_sec": round(tok_per_sec, 2)}
    )
