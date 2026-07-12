from fastapi import APIRouter

from app.services.adb_service import Device, adb_service

router = APIRouter(prefix="/api/devices", tags=["devices"])


@router.get("", response_model=list[Device])
async def list_devices() -> list[Device]:
    return await adb_service.list_devices()


@router.post("/select/{serial}")
async def select_device(serial: str) -> dict:
    adb_service.set_active_serial(serial)
    return {"active_serial": serial}


@router.get("/active")
async def active_device() -> dict:
    return {"active_serial": adb_service.active_serial()}
