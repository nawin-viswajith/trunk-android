from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings
from app.routers import huggingface, support

app = FastAPI(title="PocketCoder Backend", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list(),
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(huggingface.router)
app.include_router(support.router)


@app.get("/api/health")
def health() -> dict:
    return {"status": "ok"}
