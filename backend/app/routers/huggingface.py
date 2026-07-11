import asyncio
import uuid

from fastapi import APIRouter, HTTPException

from app.models.huggingface import HfDownloadRequest, HfGgufFile, HfModelSummary
from app.services import huggingface_service

router = APIRouter(prefix="/api/huggingface", tags=["huggingface"])


@router.get("/search", response_model=list[HfModelSummary])
async def search(q: str, limit: int = 25) -> list[HfModelSummary]:
    return await huggingface_service.search_models(q, limit)


@router.get("/models/{repo_id:path}/files", response_model=list[HfGgufFile])
async def list_files(repo_id: str, serial: str | None = None) -> list[HfGgufFile]:
    return await huggingface_service.list_gguf_files(repo_id, serial)


@router.post("/download")
async def start_download(req: HfDownloadRequest) -> dict:
    try:
        huggingface_service.safe_download_path(req.filename)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    job_id = str(uuid.uuid4())
    asyncio.create_task(
        huggingface_service.download_file(req.repo_id, req.filename, job_id, req.device_serial)
    )
    return {"job_id": job_id}


@router.post("/download/{job_id}/cancel")
async def cancel_download(job_id: str) -> dict:
    huggingface_service.cancel_download(job_id)
    return {"status": "cancelling"}
