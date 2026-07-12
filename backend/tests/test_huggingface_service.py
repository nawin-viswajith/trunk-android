import asyncio

import httpx
import pytest

from app.config import settings
from app.services import huggingface_service
from app.services.compatibility_service import DeviceMemory


class _FakeResponse:
    def __init__(self, json_data):
        self._json_data = json_data

    def raise_for_status(self):
        pass

    def json(self):
        return self._json_data


class _FakeClient:
    def __init__(self, json_data):
        self._json_data = json_data

    async def __aenter__(self):
        return self

    async def __aexit__(self, *exc):
        return False

    async def get(self, url, params=None):
        return _FakeResponse(self._json_data)


@pytest.mark.asyncio
async def test_search_models_maps_fields(monkeypatch):
    fake_results = [{"id": "Qwen/Qwen2.5-Coder-7B-Instruct-GGUF", "downloads": 179753, "likes": 312}]
    monkeypatch.setattr(httpx, "AsyncClient", lambda timeout=10.0: _FakeClient(fake_results))

    results = await huggingface_service.search_models("qwen2.5-coder")

    assert len(results) == 1
    assert results[0].repo_id == "Qwen/Qwen2.5-Coder-7B-Instruct-GGUF"
    assert results[0].downloads == 179753


@pytest.mark.asyncio
async def test_list_gguf_files_filters_split_shards_and_non_gguf(monkeypatch):
    tree = [
        {"path": "README.md", "size": 100},
        {"path": "model-q4_0.gguf", "size": 4_000_000_000},
        {"path": "model-q4_0-00001-of-00002.gguf", "size": 3_000_000_000},
        {"path": "model-q4_0-00002-of-00002.gguf", "size": 1_000_000_000},
    ]
    monkeypatch.setattr(httpx, "AsyncClient", lambda timeout=10.0: _FakeClient(tree))

    async def fake_get_device_memory(serial):
        return DeviceMemory(total_mb=16000, available_mb=12000)

    monkeypatch.setattr(
        huggingface_service.compatibility_service, "get_device_memory", fake_get_device_memory
    )

    files = await huggingface_service.list_gguf_files("some/repo", serial=None)

    assert [f.filename for f in files] == ["model-q4_0.gguf"]
    assert files[0].quant == "Q4_0"
    assert files[0].compatibility.category == "supported"


def test_safe_download_path_rejects_traversal():
    with pytest.raises(ValueError):
        huggingface_service.safe_download_path("../../etc/passwd")


def test_safe_download_path_accepts_plain_filename(tmp_path, monkeypatch):
    monkeypatch.setattr(settings, "models_dir", tmp_path)
    path = huggingface_service.safe_download_path("model.gguf")
    assert path.parent == tmp_path.resolve()


@pytest.mark.asyncio
async def test_cancel_download_sets_event():
    event = asyncio.Event()
    huggingface_service._cancel_events["job-1"] = event
    huggingface_service.cancel_download("job-1")
    assert event.is_set()
    huggingface_service._cancel_events.pop("job-1", None)


@pytest.mark.asyncio
async def test_cancel_download_unknown_job_is_a_noop():
    huggingface_service.cancel_download("does-not-exist")  # must not raise


@pytest.mark.asyncio
async def test_search_models_against_real_hf_api():
    """Lightweight integration check against the real API to catch shape
    drift -- skips gracefully if this environment has no network access."""
    try:
        results = await huggingface_service.search_models("qwen2.5-coder", limit=3)
    except httpx.HTTPError:
        pytest.skip("no network access to huggingface.co in this environment")
        return

    assert len(results) > 0
    assert all(r.repo_id and r.downloads >= 0 for r in results)
