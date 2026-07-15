import time

from fastapi import APIRouter, Header, HTTPException, Request

from app.config import settings
from app.models.support import CrashReportRequest, CrashReportResponse
from app.services import github_service

router = APIRouter(prefix="/api/support", tags=["support"])

# Per-IP sliding window, in-memory - resets on every deploy/restart, which is
# fine for a free-tier single-instance host where the goal is just capping
# abuse volume, not exact accounting. A dict this small (one entry per IP
# that's hit the endpoint) isn't worth a real dependency for one route.
_RATE_LIMIT_MAX_REQUESTS = 3
_RATE_LIMIT_WINDOW_SECONDS = 60 * 60
_request_log: dict[str, list[float]] = {}


def _check_rate_limit(client_ip: str) -> None:
    now = time.monotonic()
    window_start = now - _RATE_LIMIT_WINDOW_SECONDS
    recent = [t for t in _request_log.get(client_ip, []) if t >= window_start]
    if len(recent) >= _RATE_LIMIT_MAX_REQUESTS:
        raise HTTPException(status_code=429, detail="Too many crash reports from this device - try again later.")
    recent.append(now)
    _request_log[client_ip] = recent


def _check_app_secret(provided: str | None) -> None:
    # Unset app_shared_secret disables the check (local dev only) - a
    # deployed instance is expected to always set this.
    if settings.app_shared_secret and provided != settings.app_shared_secret:
        raise HTTPException(status_code=403, detail="Invalid or missing app secret.")


def _build_issue(payload: CrashReportRequest) -> tuple[str, str]:
    title = f"[Crash] {payload.context}: {payload.message[:80]}"
    body = (
        f"**Context:** {payload.context}\n"
        f"**Error:** {payload.message}\n\n"
        f"**Device:** {payload.device.model} ({payload.device.os_version})\n"
        f"**Total RAM:** {payload.device.total_memory_mb} MB\n"
        f"**App version:** {payload.app_version}\n"
    )
    if payload.recent_errors:
        body += f"\n**Recent error log:**\n```\n{payload.recent_errors}\n```\n"
    body += "\n---\n_Filed automatically from the in-app crash report prompt._"
    return title, body


@router.post("/report", response_model=CrashReportResponse)
async def report_crash(
    payload: CrashReportRequest, request: Request, x_app_secret: str | None = Header(default=None)
) -> CrashReportResponse:
    _check_app_secret(x_app_secret)
    _check_rate_limit(request.client.host if request.client else "unknown")

    title, body = _build_issue(payload)
    try:
        issue_url = await github_service.create_issue(title, body)
    except github_service.GitHubNotConfigured as e:
        raise HTTPException(status_code=503, detail=str(e)) from e
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Failed to file GitHub issue: {e}") from e
    return CrashReportResponse(issue_url=issue_url)
