from __future__ import annotations

from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

from .config import get_settings
from .database import init_db
from .routers import artifacts, chat, memory, models, prompts, settings as settings_router, skills, threads
from .routers.tts_piper import router as tts_router

app_settings = get_settings()


@asynccontextmanager
async def lifespan(_: FastAPI):
    await init_db()
    yield


app = FastAPI(title="Seafor", version="1.0.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=app_settings.cors_origin_list or ["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(settings_router.router)
app.include_router(threads.router)
app.include_router(chat.router)
app.include_router(models.router)
app.include_router(prompts.router)
app.include_router(skills.router)
app.include_router(memory.router)
app.include_router(artifacts.router)
app.include_router(tts_router)


@app.get("/api/health")
async def health():
    return {"ok": True, "app": app_settings.app_name}


# ------------------------------------------------------------------ frontend
DIST = Path(__file__).resolve().parent.parent.parent / "frontend" / "dist"
if DIST.exists():
    app.mount("/assets", StaticFiles(directory=DIST / "assets"), name="assets")

    @app.get("/")
    async def index():
        return FileResponse(DIST / "index.html")

    @app.get("/{path:path}")
    async def spa(path: str):
        candidate = DIST / path
        if candidate.is_file():
            return FileResponse(candidate)
        return FileResponse(DIST / "index.html")
