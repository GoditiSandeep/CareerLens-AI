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
    practice,
    practice_extra,  # noqa: F401  (registers routes onto practice.router)
    profile,
    resumes,
    resume_analysis,  # noqa: F401  (registers routes onto resumes.router)
    roadmap,
)
from app.core.config import settings
from app.database.db import SessionLocal, init_db


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


app = FastAPI(title=settings.APP_NAME, lifespan=lifespan)

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


app.include_router(auth.router)
app.include_router(profile.router)
app.include_router(dashboard.router)
app.include_router(resumes.router)  # also carries resume_analysis routes
app.include_router(careers.router)
app.include_router(roadmap.router)
app.include_router(jobs.router)
app.include_router(extras.router)  # also carries extras_chat routes
app.include_router(practice.router)  # also carries practice_extra routes
app.include_router(admin.router)  # admin-only dashboard API
