import time
import uuid
from typing import Optional

from sqlmodel import Field, Relationship, SQLModel


def _uuid() -> str:
    return str(uuid.uuid4())


class Project(SQLModel, table=True):
    id: str = Field(default_factory=_uuid, primary_key=True)
    name: str
    backend: str = Field(default="cpu")  # "cpu" | "hexagon" (hexagon disabled in Phase 1 UI)
    model_filename: str | None = None
    device_serial: str | None = None

    temperature: float = 0.7
    top_p: float = 0.9
    top_k: int = 40
    threads: int = 8
    context_length: int = 2048
    batch_size: int = 512
    max_tokens: int = 512

    created_at: float = Field(default_factory=time.time)
    updated_at: float = Field(default_factory=time.time)

    prompt_templates: list["PromptTemplate"] = Relationship(back_populates="project")
    history: list["HistoryEntry"] = Relationship(back_populates="project")


class PromptTemplate(SQLModel, table=True):
    id: str = Field(default_factory=_uuid, primary_key=True)
    project_id: str = Field(foreign_key="project.id")
    name: str
    template_text: str

    project: Optional[Project] = Relationship(back_populates="prompt_templates")


class HistoryEntry(SQLModel, table=True):
    id: str = Field(default_factory=_uuid, primary_key=True)
    project_id: str = Field(foreign_key="project.id")
    prompt: str
    response: str
    tokens_generated: int = 0
    tokens_per_sec: float = 0.0
    timestamp: float = Field(default_factory=time.time)

    project: Optional[Project] = Relationship(back_populates="history")
