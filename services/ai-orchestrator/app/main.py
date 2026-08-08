from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.health import router as health_router
from app.api.me import router as me_router
from app.core.config import get_settings

settings = get_settings()

app = FastAPI(
    title="XDrama AI Orchestrator",
    description=(
        "Internal orchestration service for XDrama AI Studio. Translates "
        "high-level render/generation requests into ComfyUI workflow graphs "
        "and dispatches them to GPU render nodes. Never exposed to end users "
        "directly — only the Next.js app and Trigger.dev jobs call this API."
    ),
    version="0.1.0",
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
