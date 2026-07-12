import asyncio
import uuid

from fastapi import APIRouter
from sqlmodel import Session

from app.core.ring_buffer import Broadcaster
from app.db import engine
from app.deps import SessionDep
from app.services import deployment_service

router = APIRouter(prefix="/api/deployment", tags=["deployment"])

step_broadcaster = Broadcaster(maxlen=10)


@router.get("/progress")
def get_progress(session: SessionDep, serial: str) -> dict:
    return deployment_service.get_progress(session, serial)


@router.post("/run/{step_id}")
async def run_step(step_id: int, serial: str) -> dict:
    """Runs a wizard step (some take many minutes, e.g. the on-device
    llama.cpp build) in the background and returns a job_id immediately.
    Live command output flows to /ws/logs the whole time; the final
    CheckResult for this step arrives once on /ws/deployment/{job_id}."""
    job_id = str(uuid.uuid4())

    async def _run() -> None:
        with Session(engine) as session:
            result = await deployment_service.run_step(session, serial, step_id)
        await step_broadcaster.publish(job_id, {"type": "result", **result.model_dump()})

    asyncio.create_task(_run())
    return {"job_id": job_id}
