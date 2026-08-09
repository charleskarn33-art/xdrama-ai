from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.export_jobs import router as export_jobs_router
from app.api.health import router as health_router
from app.api.me import router as me_router
from app.api.models import router as models_router
from app.api.render_jobs import router as render_jobs_router
from app.api.suggestions import router as suggestions_router
from app.core.config import get_settings
from app.core.supabase import create_service_client

settings = get_settings()


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncIterator[None]:
    app.state.supabase = await create_service_client()
    yield


app = FastAPI(
    title="XDrama AI Orchestrator",
    description=(
        "Internal orchestration service for XDrama AI Studio. Translates "
        "high-level render/generation requests into ComfyUI workflow graphs "
        "and dispatches them to GPU render nodes. Never exposed to end users "
        "directly — only the Next.js app and Trigger.dev jobs call this API."
    ),
    version="0.1.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(health_router)
app.include_router(me_router, prefix="/api")
app.include_router(models_router, prefix="/api")
app.include_router(render_jobs_router, prefix="/api")
app.include_router(suggestions_router, prefix="/api")
app.include_router(export_jobs_router, prefix="/api")
