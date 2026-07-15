from pydantic import BaseModel


class HfModelSummary(BaseModel):
    repo_id: str
    url: str
    downloads: int
    likes: int
    pipeline_tag: str | None
    library_name: str | None
    params: str | None
    tags: list[str]


class HfGgufFile(BaseModel):
    filename: str
    size_bytes: int
    quant: str | None
