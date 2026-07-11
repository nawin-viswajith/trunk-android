"""
Estimates whether a GGUF model will fit in a connected phone's RAM.

This is a heuristic, not an exact model: llama.cpp's actual runtime memory use
depends on architecture details (layer count, head dims, KV cache config) that
we don't have without downloading the file. We approximate required memory as
the file size plus a fixed overhead for compute buffers + KV cache at this
app's fixed context length (2048, see PLAN's Deployment Wizard rationale), and
categorize against the phone's currently *available* RAM (not total, since
Android and other apps already claim a chunk of it).
"""

from dataclasses import dataclass
from typing import Literal

from app.services.adb_service import adb_service

CompatibilityCategory = Literal["supported", "can_bottleneck", "not_supported", "unknown"]

_OVERHEAD_FACTOR = 1.2
_FIXED_OVERHEAD_MB = 512
_SUPPORTED_THRESHOLD = 0.6  # required_mb <= 60% of available -> comfortable headroom


@dataclass
class DeviceMemory:
    total_mb: float | None
    available_mb: float | None


@dataclass
class CompatibilityResult:
    category: CompatibilityCategory
    required_mb: float
    available_mb: float | None
    total_mb: float | None
    message: str


async def get_device_memory(serial: str | None) -> DeviceMemory:
    try:
        result = await adb_service.shell(["cat", "/proc/meminfo"], serial=serial)
    except ValueError:
        return DeviceMemory(total_mb=None, available_mb=None)

    if not result.ok:
        return DeviceMemory(total_mb=None, available_mb=None)

    total_kb: float | None = None
    available_kb: float | None = None
    for line in result.stdout_lines:
        if line.startswith("MemTotal:"):
            total_kb = _parse_kb(line)
        elif line.startswith("MemAvailable:"):
            available_kb = _parse_kb(line)

    return DeviceMemory(
        total_mb=total_kb / 1024 if total_kb is not None else None,
        available_mb=available_kb / 1024 if available_kb is not None else None,
    )


def _parse_kb(line: str) -> float | None:
    parts = line.split()
    if len(parts) < 2:
        return None
    try:
        return float(parts[1])
    except ValueError:
        return None


def estimate_required_mb(file_size_bytes: int) -> float:
    file_size_mb = file_size_bytes / (1024 * 1024)
    return file_size_mb * _OVERHEAD_FACTOR + _FIXED_OVERHEAD_MB


def categorize(required_mb: float, available_mb: float) -> CompatibilityCategory:
    if required_mb <= available_mb * _SUPPORTED_THRESHOLD:
        return "supported"
    if required_mb <= available_mb:
        return "can_bottleneck"
    return "not_supported"


def build_compatibility(file_size_bytes: int, memory: DeviceMemory) -> CompatibilityResult:
    """Pure (no I/O) variant of check_compatibility for callers that already
    fetched DeviceMemory once and are evaluating it against many files --
    avoids one `adb shell` round-trip per file."""
    required_mb = estimate_required_mb(file_size_bytes)

    if memory.available_mb is None:
        return CompatibilityResult(
            category="unknown",
            required_mb=required_mb,
            available_mb=None,
            total_mb=memory.total_mb,
            message="Connect a device to check whether this model fits in memory.",
        )

    category = categorize(required_mb, memory.available_mb)
    messages = {
        "supported": f"Estimated ~{required_mb:.0f} MB needed, {memory.available_mb:.0f} MB available -- comfortable fit.",
        "can_bottleneck": (
            f"Estimated ~{required_mb:.0f} MB needed, {memory.available_mb:.0f} MB available -- "
            "will likely run but expect slowdowns, thermal throttling, or other apps getting killed."
        ),
        "not_supported": (
            f"Estimated ~{required_mb:.0f} MB needed, only {memory.available_mb:.0f} MB available -- "
            "likely to crash from out-of-memory."
        ),
    }
    return CompatibilityResult(
        category=category,
        required_mb=required_mb,
        available_mb=memory.available_mb,
        total_mb=memory.total_mb,
        message=messages[category],
    )


async def check_compatibility(file_size_bytes: int, serial: str | None) -> CompatibilityResult:
    memory = await get_device_memory(serial)
    return build_compatibility(file_size_bytes, memory)
