import dataclasses

from fastapi import APIRouter, WebSocket, WebSocketDisconnect

from app.core.ring_buffer import broadcaster
from app.routers.deployment import step_broadcaster
from app.routers.diagnostics import check_broadcaster
from app.services.huggingface_service import download_broadcaster
from app.services.inference_service import frame_broadcaster
from app.services.log_service import GLOBAL_CHANNEL

router = APIRouter(prefix="/ws", tags=["websocket"])


@router.websocket("/logs")
async def ws_logs(websocket: WebSocket) -> None:
    await websocket.accept()
    for line in broadcaster.history(GLOBAL_CHANNEL):
        await websocket.send_json(dataclasses.asdict(line))
    queue = await broadcaster.subscribe(GLOBAL_CHANNEL)
    try:
        while True:
            line = await queue.get()
            await websocket.send_json(dataclasses.asdict(line))
    except WebSocketDisconnect:
        pass
    finally:
        await broadcaster.unsubscribe(GLOBAL_CHANNEL, queue)


@router.websocket("/diagnostics/{job_id}")
async def ws_diagnostics(websocket: WebSocket, job_id: str) -> None:
    await websocket.accept()
    for item in check_broadcaster.history(job_id):
        await websocket.send_json(item)
        if item.get("type") == "done":
            return
    queue = await check_broadcaster.subscribe(job_id)
    try:
        while True:
            item = await queue.get()
            await websocket.send_json(item)
            if item.get("type") == "done":
                break
    except WebSocketDisconnect:
        pass
    finally:
        await check_broadcaster.unsubscribe(job_id, queue)


@router.websocket("/deployment/{job_id}")
async def ws_deployment(websocket: WebSocket, job_id: str) -> None:
    await websocket.accept()
    history = step_broadcaster.history(job_id)
    if history:
        await websocket.send_json(history[-1])
        return
    queue = await step_broadcaster.subscribe(job_id)
    try:
        item = await queue.get()
        await websocket.send_json(item)
    except WebSocketDisconnect:
        pass
    finally:
        await step_broadcaster.unsubscribe(job_id, queue)


@router.websocket("/inference/{job_id}")
async def ws_inference(websocket: WebSocket, job_id: str) -> None:
    await websocket.accept()
    for item in frame_broadcaster.history(job_id):
        await websocket.send_json(item)
        if item.get("type") in ("done", "error"):
            return
    queue = await frame_broadcaster.subscribe(job_id)
    try:
        while True:
            item = await queue.get()
            await websocket.send_json(item)
            if item.get("type") in ("done", "error"):
                break
    except WebSocketDisconnect:
        pass
    finally:
        await frame_broadcaster.unsubscribe(job_id, queue)


@router.websocket("/huggingface/{job_id}")
async def ws_huggingface_download(websocket: WebSocket, job_id: str) -> None:
    await websocket.accept()
    terminal_types = {"done", "error", "cancelled"}
    for item in download_broadcaster.history(job_id):
        await websocket.send_json(item)
        if item.get("type") in terminal_types:
            return
    queue = await download_broadcaster.subscribe(job_id)
    try:
        while True:
            item = await queue.get()
            await websocket.send_json(item)
            if item.get("type") in terminal_types:
                break
    except WebSocketDisconnect:
        pass
    finally:
        await download_broadcaster.unsubscribe(job_id, queue)
