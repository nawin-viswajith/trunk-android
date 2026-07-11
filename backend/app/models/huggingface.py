from pydantic import BaseModel


class HfModelSummary(BaseModel):
    repo_id: str
    downloads: int
    likes: int


class HfGgufFile(BaseModel):
    filename: str
    size_bytes: int
    quant: str | None
