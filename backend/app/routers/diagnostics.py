import asyncio
import uuid

from fastapi import APIRouter

from app.core.ring_buffer import Broadcaster
from app.services import diagnostics_service

router = APIRouter(prefix="/api/diagnostics", tags=["diagnostics"])

check_broadcaster = Broadcaster(maxlen=200)


@router.post("/run")
async def run_diagnostics(serial: str | None = None) -> dict:
    """Kicks off a diagnostics run and streams each check result (as a plain
    dict: {type: "check", ...CheckResult} then {type: "done"}) over
    /ws/diagnostics/{job_id} as it completes. Returns immediately with a job_id."""
    job_id = str(uuid.uuid4())

    async def _run() -> None:
        async for check in diagnostics_service.run_all(serial):
            await check_broadcaster.publish(job_id, {"type": "check", **check.model_dump()})
        await check_broadcaster.publish(job_id, {"type": "done"})

    asyncio.create_task(_run())
    return {"job_id": job_id}
