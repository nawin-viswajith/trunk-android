import asyncio
import sys
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

if sys.platform == "win32":
    # SelectorEventLoop (which uvicorn --reload can end up defaulting to on
    # Windows) cannot spawn subprocesses at all -- every adb/command_runner
    # call would raise NotImplementedError. ProactorEventLoop supports them.
    asyncio.set_event_loop_policy(asyncio.WindowsProactorEventLoopPolicy())

from app.config import settings
from app.db import init_db
from app.routers import deployment, devices, diagnostics, huggingface, inference, models, projects, ws


@asynccontextmanager
async def lifespan(app: FastAPI):
    init_db()
    yield


app = FastAPI(title="PocketCoder Backend", version="0.1.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list(),
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(devices.router)
app.include_router(diagnostics.router)
app.include_router(deployment.router)
app.include_router(models.router)
app.include_router(huggingface.router)
app.include_router(projects.router)
app.include_router(inference.router)
app.include_router(ws.router)


@app.get("/api/health")
def health() -> dict:
    return {"status": "ok"}
