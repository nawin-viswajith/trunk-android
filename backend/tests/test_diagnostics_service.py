import pytest

from app.core.command_runner import CommandResult
from app.services import diagnostics_service
from app.services.adb_service import Device


def _result(stdout: list[str], exit_code: int = 0) -> CommandResult:
    return CommandResult(exit_code=exit_code, stdout_lines=stdout, stderr_lines=[], duration_ms=1.0)


@pytest.mark.asyncio
async def test_check_adb_binary_pass(monkeypatch):
    async def fake_version():
        return _result(["Android Debug Bridge version 1.0.41"])

    monkeypatch.setattr(diagnostics_service.adb_service, "version", fake_version)
    result = await diagnostics_service.check_adb_binary(None)
    assert result.status == "pass"


@pytest.mark.asyncio
async def test_check_adb_binary_fail(monkeypatch):
    async def fake_version():
        return _result([], exit_code=1)

    monkeypatch.setattr(diagnostics_service.adb_service, "version", fake_version)
    result = await diagnostics_service.check_adb_binary(None)
    assert result.status == "fail"
    assert result.fix_hint


@pytest.mark.asyncio
async def test_check_device_connected_unauthorized(monkeypatch):
    async def fake_list_devices():
        return [Device(serial="ABC123", state="unauthorized")]

    monkeypatch.setattr(diagnostics_service.adb_service, "list_devices", fake_list_devices)
    result, resolved_serial = await diagnostics_service.check_device_connected(None)
    assert result.status == "fail"
    assert "unauthorized" in result.detail.lower()
    assert resolved_serial is None


@pytest.mark.asyncio
async def test_check_device_connected_pass(monkeypatch):
    async def fake_list_devices():
        return [Device(serial="ABC123", state="device")]

    monkeypatch.setattr(diagnostics_service.adb_service, "list_devices", fake_list_devices)
    result, resolved_serial = await diagnostics_service.check_device_connected(None)
    assert result.status == "pass"
    assert resolved_serial == "ABC123"


@pytest.mark.asyncio
async def test_check_npu_backend_always_fails_with_explanation():
    result = await diagnostics_service.check_npu_backend(None)
    assert result.status == "fail"
    assert "libggml-htp-v81.so" in result.detail
    assert "0x80000406" in result.detail


@pytest.mark.asyncio
async def test_check_gguf_present_pass(monkeypatch):
    async def fake_shell(args, serial=None):
        return _result(["model.gguf", "readme.txt"])

    monkeypatch.setattr(diagnostics_service.adb_service, "shell", fake_shell)
    result = await diagnostics_service.check_gguf_present("ABC123")
    assert result.status == "pass"
    assert "model.gguf" in result.detail


@pytest.mark.asyncio
async def test_check_gguf_present_fail(monkeypatch):
    async def fake_shell(args, serial=None):
        return _result(["readme.txt"])

    monkeypatch.setattr(diagnostics_service.adb_service, "shell", fake_shell)
    result = await diagnostics_service.check_gguf_present("ABC123")
    assert result.status == "fail"


@pytest.mark.asyncio
async def test_run_all_short_circuits_when_adb_binary_missing(monkeypatch):
    async def fake_version():
        return _result([], exit_code=1)

    monkeypatch.setattr(diagnostics_service.adb_service, "version", fake_version)
    results = [check async for check in diagnostics_service.run_all(None)]
    assert len(results) == 1
    assert results[0].id == "adb_binary"
    assert results[0].status == "fail"
