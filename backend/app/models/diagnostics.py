from typing import Literal

from pydantic import BaseModel

CheckStatus = Literal["pass", "fail", "warn", "skipped"]


class CheckResult(BaseModel):
    id: str
    label: str
    status: CheckStatus
    detail: str
    fix_hint: str | None = None
    can_auto_fix: bool = False
