import time

from sqlmodel import Field, SQLModel


class WizardState(SQLModel, table=True):
    serial: str = Field(primary_key=True)
    current_step: int = 0  # 0-4, index into deployment_service.STEPS
    step_status_json: str = "{}"  # {"1": "pass", "2": "fail", ...}
    updated_at: float = Field(default_factory=time.time)
