from pydantic import BaseModel


class CrashReportDevice(BaseModel):
    model: str
    os_version: str
    total_memory_mb: int


class CrashReportRequest(BaseModel):
    context: str
    message: str
    device: CrashReportDevice
    app_version: str
    # Recent on-device error log entries (see app/src/services/sessionLog.ts) -
    # only the error trail, never the opt-in usage-event log - included so the
    # filed issue has enough trail to actually reproduce the crash from,
    # instead of just the single error message that triggered the prompt.
    recent_errors: str | None = None
    # ISO 8601 - when the failure actually happened, not when this request
    # was sent. A report can be queued and retried well after the fact (app
    # was offline, or crashed before it could send) - see
    # app/src/services/crashReportQueue.ts.
    occurred_at: str | None = None


class CrashReportResponse(BaseModel):
    issue_url: str
