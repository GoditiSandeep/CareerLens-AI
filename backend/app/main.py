"""CareerLens AI — FastAPI application entry point."""
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api import (
    admin,
    auth,
    careers,
    dashboard,
    extras,
    extras_chat,  # noqa: F401  (registers routes onto extras.router)
    jobs,
    planner,
    practice,
    practice_extra,  # noqa: F401  (registers routes onto practice.router)
    profile,
    quest,
    resumes,
    resume_analysis,  # noqa: F401  (registers routes onto resumes.router)
    roadmap,
    twin,
)
from app.core.config import settings
from app.database.db import SessionLocal, init_db
from app.ai.service import is_mock_mode, get_ai_provider


@asynccontextmanager
async def lifespan(app: FastAPI):
    init_db()
    if settings.SEED_DEMO_DATA:
        from app.services.seeder import seed_all

        db = SessionLocal()
        try:
            seed_all(db)
        finally:
            db.close()
    yield


app = FastAPI(
    title=settings.APP_NAME,
    lifespan=lifespan,
    # Docs follow DEBUG: production validation forces DEBUG=false, which
    # removes /docs, /redoc and /openapi.json from the public surface.
    docs_url="/docs" if settings.docs_enabled else None,
    redoc_url="/redoc" if settings.docs_enabled else None,
    openapi_url="/openapi.json" if settings.docs_enabled else None,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
def health():
    return {"status": "healthy"}


@app.get("/ai/status")
def ai_status():
    """Public, secret-free AI mode indicator.

    Lets the UI honestly label whether AI features are running on a real
    configured provider or the deterministic offline fallback. Never exposes
    keys, tokens, or model credentials — only the provider name and mode.
    """
    provider = get_ai_provider()
    mock = is_mock_mode()
    return {
        "provider": settings.AI_PROVIDER.strip().lower() or "mock",
        "mode": "mock" if mock else "live",
        "live_configured": not mock,
        "provider_class": type(provider).__name__,
        "note": (
            "Deterministic offline fallback — no external AI model was called. "
            "Responses are generated locally and clearly labelled."
            if mock else
            "A real AI provider is configured and active. Personal data is only "
            "sent with your consent."
        ),
    }


app.include_router(auth.router)
app.include_router(profile.router)
app.include_router(dashboard.router)
app.include_router(resumes.router)  # also carries resume_analysis routes
app.include_router(careers.router)
app.include_router(roadmap.router)
app.include_router(jobs.router)
app.include_router(extras.router)  # also carries extras_chat routes
app.include_router(practice.router)  # also carries practice_extra routes
app.include_router(twin.router)  # AI Career Twin
app.include_router(planner.router)  # Adaptive Growth Planner
app.include_router(quest.router)  # Career Quest gamification
app.include_router(admin.router)  # admin-only dashboard API
