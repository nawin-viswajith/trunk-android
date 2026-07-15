import httpx
import pytest

from app.services import github_service


class _FakeResponse:
    def __init__(self, json_data, status_code=201):
        self._json_data = json_data
        self.status_code = status_code

    def raise_for_status(self):
        if self.status_code >= 400:
            raise httpx.HTTPStatusError("error", request=None, response=self)

    def json(self):
        return self._json_data


class _FakeClient:
    def __init__(self, json_data, status_code=201):
        self._json_data = json_data
        self._status_code = status_code
        self.last_request = None

    async def __aenter__(self):
        return self

    async def __aexit__(self, *exc):
        return False

    async def post(self, url, headers=None, json=None):
        self.last_request = {"url": url, "headers": headers, "json": json}
        return _FakeResponse(self._json_data, self._status_code)


@pytest.mark.asyncio
async def test_create_issue_raises_when_not_configured(monkeypatch):
    monkeypatch.setattr(github_service.settings, "github_token", None)
    monkeypatch.setattr(github_service.settings, "github_repo", None)

    with pytest.raises(github_service.GitHubNotConfigured):
        await github_service.create_issue("title", "body")


@pytest.mark.asyncio
async def test_create_issue_calls_github_api_when_configured(monkeypatch):
    monkeypatch.setattr(github_service.settings, "github_token", "fake-token")
    monkeypatch.setattr(github_service.settings, "github_repo", "owner/repo")
    fake_client = _FakeClient({"html_url": "https://github.com/owner/repo/issues/1"})
    monkeypatch.setattr(httpx, "AsyncClient", lambda timeout=10.0: fake_client)

    issue_url = await github_service.create_issue("My title", "My body")

    assert issue_url == "https://github.com/owner/repo/issues/1"
    assert fake_client.last_request["url"] == f"{github_service.GITHUB_API_BASE}/repos/owner/repo/issues"
    assert fake_client.last_request["headers"]["Authorization"] == "Bearer fake-token"
    assert fake_client.last_request["json"] == {"title": "My title", "body": "My body"}
