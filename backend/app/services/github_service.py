import httpx

from app.config import settings

GITHUB_API_BASE = "https://api.github.com"


class GitHubNotConfigured(Exception):
    """Raised when github_token/github_repo haven't been set on this server yet."""


async def create_issue(title: str, body: str) -> str:
    if not settings.github_token or not settings.github_repo:
        raise GitHubNotConfigured("GitHub crash reporting is not configured on this server.")

    async with httpx.AsyncClient(timeout=10.0) as client:
        resp = await client.post(
            f"{GITHUB_API_BASE}/repos/{settings.github_repo}/issues",
            headers={
                "Authorization": f"Bearer {settings.github_token}",
                "Accept": "application/vnd.github+json",
            },
            json={"title": title, "body": body},
        )
        resp.raise_for_status()
        return resp.json()["html_url"]
