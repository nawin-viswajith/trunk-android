import httpx
import pytest

from app.main import app
from app.routers import support


def _payload():
    return {
        "context": "Benchmark",
        "message": "boom",
        "device": {"model": "Pixel 8", "os_version": "Android 15", "total_memory_mb": 8192},
        "app_version": "1.3.5",
    }


@pytest.fixture(autouse=True)
def _reset_rate_limit():
    support._request_log.clear()
    yield
    support._request_log.clear()


async def _post(monkeypatch, headers=None, issue_url="https://github.com/owner/repo/issues/1"):
    async def fake_create_issue(title, body):
        return issue_url

    monkeypatch.setattr(support.github_service, "create_issue", fake_create_issue)
    transport = httpx.ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://test") as client:
        return await client.post("/api/support/report", json=_payload(), headers=headers)


@pytest.mark.asyncio
async def test_report_rejects_wrong_secret(monkeypatch):
    monkeypatch.setattr(support.settings, "app_shared_secret", "correct-secret")

    resp = await _post(monkeypatch, headers={"X-App-Secret": "wrong"})

    assert resp.status_code == 403


@pytest.mark.asyncio
async def test_report_accepts_correct_secret(monkeypatch):
    monkeypatch.setattr(support.settings, "app_shared_secret", "correct-secret")

    resp = await _post(monkeypatch, headers={"X-App-Secret": "correct-secret"})

    assert resp.status_code == 200
    assert resp.json()["issue_url"] == "https://github.com/owner/repo/issues/1"


@pytest.mark.asyncio
async def test_report_allows_any_secret_when_unset(monkeypatch):
    monkeypatch.setattr(support.settings, "app_shared_secret", None)

    resp = await _post(monkeypatch, headers=None)

    assert resp.status_code == 200


@pytest.mark.asyncio
async def test_report_rate_limits_after_max_requests(monkeypatch):
    monkeypatch.setattr(support.settings, "app_shared_secret", None)

    for _ in range(support._RATE_LIMIT_MAX_REQUESTS):
        resp = await _post(monkeypatch)
        assert resp.status_code == 200

    resp = await _post(monkeypatch)

    assert resp.status_code == 429
