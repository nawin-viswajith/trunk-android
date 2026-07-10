from fastapi import APIRouter, HTTPException

from app.deps import SessionDep
from app.models.inference import InferenceStartRequest, InferenceStartResponse
from app.services import inference_service, project_service

router = APIRouter(prefix="/api/inference", tags=["inference"])


@router.post("/start", response_model=InferenceStartResponse)
async def start_inference(req: InferenceStartRequest, session: SessionDep) -> InferenceStartResponse:
    project = project_service.get_project(session, req.project_id)
    if project is None:
        raise HTTPException(status_code=404, detail="project not found")
    if not project.model_filename:
        raise HTTPException(status_code=400, detail="project has no model assigned")

    try:
        await inference_service.ensure_server_running(project, project.device_serial)
    except (ValueError, RuntimeError) as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc

    job_id = await inference_service.run_inference(project, req.prompt)
    return InferenceStartResponse(job_id=job_id)
