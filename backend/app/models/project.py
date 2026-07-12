from pydantic import BaseModel, Field


class ProjectCreate(BaseModel):
    name: str
    backend: str = "cpu"
    model_filename: str | None = None
    device_serial: str | None = None


class ProjectUpdate(BaseModel):
    name: str | None = None
    model_filename: str | None = None
    device_serial: str | None = None
    temperature: float | None = None
    top_p: float | None = None
    top_k: int | None = None
    threads: int | None = None
    context_length: int | None = None
    batch_size: int | None = None
    max_tokens: int | None = Field(default=None, gt=0, le=8192)


class PromptTemplateCreate(BaseModel):
    name: str
    template_text: str
