from pydantic import BaseModel, Field


class InferenceStartRequest(BaseModel):
    project_id: str
    prompt: str = Field(min_length=1, max_length=32_000)


class InferenceStartResponse(BaseModel):
    job_id: str
