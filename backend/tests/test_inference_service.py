import pytest

from app.core.command_runner import CommandResult
from app.db_models.project import Project
from app.services import inference_service


def _result(stdout: list[str], exit_code: int = 0) -> CommandResult:
    return CommandResult(exit_code=exit_code, stdout_lines=stdout, stderr_lines=[], duration_ms=1.0)


def _project(**overrides) -> Project:
    defaults = dict(name="Test", model_filename="model.gguf")
    defaults.update(overrides)
    return Project(**defaults)


@pytest.mark.asyncio
async def test_ensure_server_running_raises_without_model():
    with pytest.raises(ValueError):
        await inference_service.ensure_server_running(_project(model_filename=None))


@pytest.mark.asyncio
async def test_ensure_server_running_skips_forward_and_start_when_already_reachable(monkeypatch):
    forward_calls = []
    run_command_calls = []

    async def fake_forward_list(serial=None):
        return _result([])  # not already forwarded

    async def fake_forward(local_port, remote_port, serial=None):
        forward_calls.append((local_port, remote_port))
        return _result([])

    async def fake_run_command(command, serial=None, category="System"):
        run_command_calls.append(command)
        return "job-id"

    monkeypatch.setattr(inference_service.adb_service, "forward_list", fake_forward_list)
    monkeypatch.setattr(inference_service.adb_service, "forward", fake_forward)
    monkeypatch.setattr(inference_service.termux_service, "run_command", fake_run_command)
    monkeypatch.setattr(inference_service, "_server_reachable", _true)

    await inference_service.ensure_server_running(_project())

    assert forward_calls == [(inference_service.settings.llama_server_port, inference_service.settings.llama_server_port)]
    assert run_command_calls == []  # server was already reachable, no need to start it


@pytest.mark.asyncio
async def test_ensure_server_running_skips_forward_when_already_forwarded(monkeypatch):
    forward_calls = []

    async def fake_forward_list(serial=None):
        return _result([f"tcp:{inference_service.settings.llama_server_port} tcp:8080"])

    async def fake_forward(local_port, remote_port, serial=None):
        forward_calls.append((local_port, remote_port))
        return _result([])

    monkeypatch.setattr(inference_service.adb_service, "forward_list", fake_forward_list)
    monkeypatch.setattr(inference_service.adb_service, "forward", fake_forward)
    monkeypatch.setattr(inference_service, "_server_reachable", _true)

    await inference_service.ensure_server_running(_project())

    assert forward_calls == []


@pytest.mark.asyncio
async def test_ensure_server_running_starts_server_when_unreachable(monkeypatch):
    run_command_calls = []
    reachable_after_start = {"value": False}

    async def fake_forward_list(serial=None):
        return _result([f"tcp:{inference_service.settings.llama_server_port} tcp:8080"])

    async def fake_run_command(command, serial=None, category="System"):
        run_command_calls.append(command)
        reachable_after_start["value"] = True
        return "job-id"

    async def fake_reachable():
        return reachable_after_start["value"]

    async def fake_sleep(_seconds):
        return None

    monkeypatch.setattr(inference_service.adb_service, "forward_list", fake_forward_list)
    monkeypatch.setattr(inference_service.termux_service, "run_command", fake_run_command)
    monkeypatch.setattr(inference_service, "_server_reachable", fake_reachable)
    monkeypatch.setattr(inference_service.asyncio, "sleep", fake_sleep)

    await inference_service.ensure_server_running(_project())

    assert len(run_command_calls) == 1
    assert "llama-server" in run_command_calls[0]
    assert "model.gguf" in run_command_calls[0]


@pytest.mark.asyncio
async def test_ensure_server_running_gives_up_after_timeout(monkeypatch):
    async def fake_forward_list(serial=None):
        return _result([f"tcp:{inference_service.settings.llama_server_port} tcp:8080"])

    async def fake_run_command(command, serial=None, category="System"):
        return "job-id"

    async def fake_sleep(_seconds):
        return None

    monkeypatch.setattr(inference_service.adb_service, "forward_list", fake_forward_list)
    monkeypatch.setattr(inference_service.termux_service, "run_command", fake_run_command)
    monkeypatch.setattr(inference_service, "_server_reachable", _false)
    monkeypatch.setattr(inference_service.asyncio, "sleep", fake_sleep)

    with pytest.raises(RuntimeError):
        await inference_service.ensure_server_running(_project())


async def _true() -> bool:
    return True


async def _false() -> bool:
    return False
