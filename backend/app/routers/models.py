from fastapi import APIRouter, HTTPException

from app.models.model import ModelInfo, ModelPushRequest
from app.services import model_service

router = APIRouter(prefix="/api/models", tags=["models"])


@router.get("", response_model=list[ModelInfo])
async def list_models(serial: str | None = None) -> list[ModelInfo]:
    return await model_service.list_models(serial)


@router.post("/push")
async def push_model(req: ModelPushRequest) -> dict:
    try:
        await model_service.push_model(req.filename, req.device_serial)
    except (FileNotFoundError, ValueError) as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except RuntimeError as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc
    return {"status": "pushed"}


@router.delete("/{filename}")
async def delete_model(filename: str, delete_on_device: bool = False, serial: str | None = None) -> dict:
    try:
        await model_service.delete_model(filename, delete_on_device, serial)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    return {"status": "deleted"}
