import pytest

from app.config import settings
from app.core.command_runner import CommandResult
from app.services import model_service


def _result(stdout: list[str], exit_code: int = 0) -> CommandResult:
    return CommandResult(exit_code=exit_code, stdout_lines=stdout, stderr_lines=[], duration_ms=1.0)


@pytest.fixture()
def models_dir(tmp_path, monkeypatch):
    monkeypatch.setattr(settings, "models_dir", tmp_path)
    return tmp_path


@pytest.mark.asyncio
async def test_list_models_empty(models_dir, monkeypatch):
    monkeypatch.setattr(model_service.adb_service, "active_serial", lambda: None)
    assert await model_service.list_models() == []


@pytest.mark.asyncio
async def test_list_models_parses_quant_and_device_state(models_dir, monkeypatch):
    (models_dir / "qwen2.5-coder-7b-q4_0.gguf").write_bytes(b"not a real gguf header")

    async def fake_shell(args, serial=None):
        return _result(["qwen2.5-coder-7b-q4_0.gguf"])

    monkeypatch.setattr(model_service.adb_service, "shell", fake_shell)
    models = await model_service.list_models(serial="ABC123")

    assert len(models) == 1
    assert models[0].filename == "qwen2.5-coder-7b-q4_0.gguf"
    assert models[0].quant == "Q4_0"
    assert models[0].installed_on_device is True


@pytest.mark.asyncio
async def test_list_models_not_on_device_when_ls_fails(models_dir, monkeypatch):
    (models_dir / "model.gguf").write_bytes(b"junk")

    async def fake_shell(args, serial=None):
        return _result([], exit_code=1)

    monkeypatch.setattr(model_service.adb_service, "shell", fake_shell)
    models = await model_service.list_models(serial="ABC123")
    assert models[0].installed_on_device is False


@pytest.mark.asyncio
async def test_push_model_missing_file_raises(models_dir):
    with pytest.raises(FileNotFoundError):
        await model_service.push_model("does-not-exist.gguf")


@pytest.mark.asyncio
async def test_push_model_rejects_path_traversal(models_dir):
    with pytest.raises(ValueError):
        await model_service.push_model("../../etc/passwd")


@pytest.mark.asyncio
async def test_push_model_success_calls_adb_push(models_dir, monkeypatch):
    (models_dir / "model.gguf").write_bytes(b"junk")
    calls = []

    async def fake_push(local_path, remote_path, serial=None):
        calls.append((local_path, remote_path, serial))
        return _result([])

    monkeypatch.setattr(model_service.adb_service, "push", fake_push)
    await model_service.push_model("model.gguf", serial="ABC123")

    assert len(calls) == 1
    _, remote_path, serial = calls[0]
    assert remote_path == f"{settings.remote_download_dir}/model.gguf"
    assert serial == "ABC123"


@pytest.mark.asyncio
async def test_push_model_raises_on_adb_failure(models_dir, monkeypatch):
    (models_dir / "model.gguf").write_bytes(b"junk")

    async def fake_push(local_path, remote_path, serial=None):
        return _result([], exit_code=1)

    monkeypatch.setattr(model_service.adb_service, "push", fake_push)
    with pytest.raises(RuntimeError):
        await model_service.push_model("model.gguf")


@pytest.mark.asyncio
async def test_delete_model_removes_local_file_only(models_dir):
    path = models_dir / "model.gguf"
    path.write_bytes(b"junk")

    await model_service.delete_model("model.gguf", delete_on_device=False)
    assert not path.exists()


@pytest.mark.asyncio
async def test_delete_model_removes_remote_when_requested(models_dir, monkeypatch):
    path = models_dir / "model.gguf"
    path.write_bytes(b"junk")
    calls = []

    async def fake_shell(args, serial=None):
        calls.append(args)
        return _result([])

    monkeypatch.setattr(model_service.adb_service, "shell", fake_shell)
    await model_service.delete_model("model.gguf", delete_on_device=True, serial="ABC123")

    assert not path.exists()
    assert calls == [["rm", "-f", f"{settings.remote_download_dir}/model.gguf"]]
