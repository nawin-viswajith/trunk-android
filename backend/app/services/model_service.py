from pathlib import Path

from app.config import settings
from app.models.model import ModelInfo
from app.services.adb_service import adb_service
from app.utils.gguf_meta import read_gguf_info


def _safe_model_path(filename: str) -> Path:
    """Resolves `filename` inside models_dir only -- rejects path separators/
    traversal so a request can't read/delete files outside the models folder."""
    if "/" in filename or "\\" in filename or ".." in filename:
        raise ValueError(f"invalid model filename: {filename!r}")
    path = (settings.models_dir / filename).resolve()
    if path.parent != settings.models_dir.resolve():
        raise ValueError(f"invalid model filename: {filename!r}")
    return path


async def _device_gguf_filenames(serial: str | None) -> set[str]:
    if not serial and not adb_service.active_serial():
        return set()
    try:
        result = await adb_service.shell(["ls", settings.remote_download_dir], serial=serial)
    except ValueError:
        return set()
    if not result.ok:
        return set()
    return {line.strip() for line in result.stdout_lines if line.strip().endswith(".gguf")}


async def list_models(serial: str | None = None) -> list[ModelInfo]:
    on_device = await _device_gguf_filenames(serial)
    models: list[ModelInfo] = []
    for path in sorted(settings.models_dir.glob("*.gguf")):
        info = read_gguf_info(path)
        models.append(
            ModelInfo(
                filename=path.name,
                size_bytes=info.size_bytes,
                quant=info.quant_from_filename,
                architecture=info.architecture,
                context_length=info.context_length,
                installed_on_device=path.name in on_device,
            )
        )
    return models


async def push_model(filename: str, serial: str | None = None) -> None:
    local_path = _safe_model_path(filename)
    if not local_path.exists():
        raise FileNotFoundError(f"model not found locally: {filename}")
    remote_path = f"{settings.remote_download_dir}/{filename}"
    result = await adb_service.push(str(local_path), remote_path, serial=serial)
    if not result.ok:
        raise RuntimeError(f"adb push failed: {' | '.join(result.stderr_lines)}")


async def delete_model(filename: str, delete_on_device: bool, serial: str | None = None) -> None:
    local_path = _safe_model_path(filename)
    if delete_on_device:
        remote_path = f"{settings.remote_download_dir}/{filename}"
        await adb_service.shell(["rm", "-f", remote_path], serial=serial)
    if local_path.exists():
        local_path.unlink()
