import httpx
import pytest

from app.services import huggingface_service


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
    fake_results = [
        {
            "id": "Qwen/Qwen2.5-Coder-7B-Instruct-GGUF",
            "downloads": 179753,
            "likes": 312,
            "pipeline_tag": "text-generation",
            "library_name": "transformers",
            "tags": ["gguf", "text-generation", "conversational"],
        }
    ]
    monkeypatch.setattr(httpx, "AsyncClient", lambda timeout=10.0: _FakeClient(fake_results))

    results = await huggingface_service.search_models("qwen2.5-coder")

    assert len(results) == 1
    assert results[0].repo_id == "Qwen/Qwen2.5-Coder-7B-Instruct-GGUF"
    assert results[0].url == "https://huggingface.co/Qwen/Qwen2.5-Coder-7B-Instruct-GGUF"
    assert results[0].downloads == 179753
    assert results[0].pipeline_tag == "text-generation"
    assert results[0].library_name == "transformers"
    assert results[0].params == "7B"
    assert results[0].tags == ["gguf", "text-generation", "conversational"]


@pytest.mark.asyncio
async def test_search_models_filters_out_embedding_models(monkeypatch):
    fake_results = [
        {
            "id": "nomic-ai/nomic-embed-text-v1.5-GGUF",
            "downloads": 86646,
            "likes": 119,
            "pipeline_tag": "sentence-similarity",
            "tags": ["gguf", "feature-extraction", "sentence-similarity"],
        },
        {
            "id": "Qwen/Qwen2.5-Coder-7B-Instruct-GGUF",
            "downloads": 179753,
            "likes": 312,
            "pipeline_tag": "text-generation",
            "tags": ["gguf", "text-generation"],
        },
    ]
    monkeypatch.setattr(httpx, "AsyncClient", lambda timeout=10.0: _FakeClient(fake_results))

    results = await huggingface_service.search_models("qwen2.5-coder")

    assert [r.repo_id for r in results] == ["Qwen/Qwen2.5-Coder-7B-Instruct-GGUF"]


@pytest.mark.asyncio
async def test_list_gguf_files_filters_split_shards_and_non_gguf(monkeypatch):
    tree = [
        {"path": "README.md", "size": 100},
        {"path": "model-q4_0.gguf", "size": 4_000_000_000},
        {"path": "model-q4_0-00001-of-00002.gguf", "size": 3_000_000_000},
        {"path": "model-q4_0-00002-of-00002.gguf", "size": 1_000_000_000},
    ]
    monkeypatch.setattr(httpx, "AsyncClient", lambda timeout=10.0: _FakeClient(tree))

    files = await huggingface_service.list_gguf_files("some/repo")

    assert [f.filename for f in files] == ["model-q4_0.gguf"]
    assert files[0].quant == "Q4_0"
    assert files[0].size_bytes == 4_000_000_000


@pytest.mark.asyncio
async def test_search_models_against_real_hf_api():
    """Lightweight integration check against the real API to catch shape
    drift, skipping gracefully if this environment has no network access."""
    try:
        results = await huggingface_service.search_models("qwen2.5-coder", limit=3)
    except httpx.HTTPError:
        pytest.skip("no network access to huggingface.co in this environment")
        return

    assert len(results) > 0
    assert all(r.repo_id and r.downloads >= 0 for r in results)


@pytest.mark.asyncio
async def test_list_gguf_files_against_real_hf_api():
    try:
        files = await huggingface_service.list_gguf_files("Qwen/Qwen2.5-Coder-7B-Instruct-GGUF")
    except httpx.HTTPError:
        pytest.skip("no network access to huggingface.co in this environment")
        return

    assert len(files) > 0
    assert all(f.filename.endswith(".gguf") for f in files)
    assert not any(f.filename for f in files if "-of-" in f.filename)
