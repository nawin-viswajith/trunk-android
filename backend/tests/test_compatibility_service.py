import pytest

from app.core.command_runner import CommandResult
from app.services import compatibility_service
from app.services.compatibility_service import DeviceMemory


def _result(stdout: list[str], exit_code: int = 0) -> CommandResult:
    return CommandResult(exit_code=exit_code, stdout_lines=stdout, stderr_lines=[], duration_ms=1.0)


@pytest.mark.asyncio
async def test_get_device_memory_parses_meminfo(monkeypatch):
    async def fake_shell(args, serial=None):
        return _result(["MemTotal:       12184552 kB", "MemFree:         1000000 kB", "MemAvailable:    7373828 kB"])

    monkeypatch.setattr(compatibility_service.adb_service, "shell", fake_shell)
    memory = await compatibility_service.get_device_memory("ABC123")

    assert memory.total_mb == pytest.approx(12184552 / 1024)
    assert memory.available_mb == pytest.approx(7373828 / 1024)


@pytest.mark.asyncio
async def test_get_device_memory_no_device_returns_none(monkeypatch):
    async def fake_shell(args, serial=None):
        return _result([], exit_code=1)

    monkeypatch.setattr(compatibility_service.adb_service, "shell", fake_shell)
    memory = await compatibility_service.get_device_memory(None)

    assert memory.total_mb is None
    assert memory.available_mb is None


def test_estimate_required_mb():
    one_gb = 1024 * 1024 * 1024
    required = compatibility_service.estimate_required_mb(one_gb)
    assert required == pytest.approx(1024 * 1.2 + 512)


@pytest.mark.parametrize(
    "required_mb,available_mb,expected",
    [
        (1000, 10000, "supported"),        # well within 60% headroom
        (6500, 10000, "can_bottleneck"),    # over 60% but still fits
        (12000, 10000, "not_supported"),    # doesn't fit at all
        (6000, 10000, "supported"),         # exactly at the 60% boundary
    ],
)
def test_categorize_thresholds(required_mb, available_mb, expected):
    assert compatibility_service.categorize(required_mb, available_mb) == expected


def test_build_compatibility_unknown_without_device_memory():
    result = compatibility_service.build_compatibility(1024 * 1024 * 1024, DeviceMemory(total_mb=None, available_mb=None))
    assert result.category == "unknown"
    assert result.available_mb is None


def test_build_compatibility_not_supported_message_mentions_oom():
    # tiny available RAM relative to a 4GB file
    memory = DeviceMemory(total_mb=2000, available_mb=1000)
    result = compatibility_service.build_compatibility(4 * 1024 * 1024 * 1024, memory)
    assert result.category == "not_supported"
    assert "out-of-memory" in result.message


@pytest.mark.asyncio
async def test_check_compatibility_delegates_to_build_compatibility(monkeypatch):
    async def fake_get_device_memory(serial):
        return DeviceMemory(total_mb=16000, available_mb=12000)

    monkeypatch.setattr(compatibility_service, "get_device_memory", fake_get_device_memory)
    result = await compatibility_service.check_compatibility(1024 * 1024 * 1024, "ABC123")

    assert result.category == "supported"
    assert result.total_mb == 16000
