from pydantic import BaseModel


class ModelInfo(BaseModel):
    filename: str
    size_bytes: int
    quant: str | None
    architecture: str | None
    context_length: int | None
    installed_on_device: bool


class ModelPushRequest(BaseModel):
    filename: str
    device_serial: str | None = None
