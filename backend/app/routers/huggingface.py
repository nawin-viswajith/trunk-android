from fastapi import APIRouter

from app.models.huggingface import HfGgufFile, HfModelSummary
from app.services import huggingface_service

router = APIRouter(prefix="/api/huggingface", tags=["huggingface"])


@router.get("/search", response_model=list[HfModelSummary])
async def search(q: str, limit: int = 25) -> list[HfModelSummary]:
    return await huggingface_service.search_models(q, limit)


@router.get("/models/{repo_id:path}/files", response_model=list[HfGgufFile])
async def list_files(repo_id: str) -> list[HfGgufFile]:
    return await huggingface_service.list_gguf_files(repo_id)
