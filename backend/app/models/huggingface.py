from pydantic import BaseModel

from app.services.compatibility_service import CompatibilityCategory


class HfModelSummary(BaseModel):
    repo_id: str
    downloads: int
    likes: int


class CompatibilityInfo(BaseModel):
    category: CompatibilityCategory
    required_mb: float
    available_mb: float | None
    total_mb: float | None
    message: str


class HfGgufFile(BaseModel):
    filename: str
    size_bytes: int
    quant: str | None
    compatibility: CompatibilityInfo


class HfDownloadRequest(BaseModel):
    repo_id: str
    filename: str
    device_serial: str | None = None
