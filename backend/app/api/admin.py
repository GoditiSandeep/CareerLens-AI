"""Administrator-only API — dashboard analytics, user management, content.

Every route below requires an authenticated user whose DB role is "admin"
(AdminUser dependency). The frontend mirrors these checks for UX only;
this router is the security boundary. No route here ever returns password
hashes, tokens, or secrets.
"""
import json
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, HTTPException, Query
from sqlalchemy import func, or_

from app.api.deps import AdminUser, DbSession
from app.core.config import settings
from app.models.career import CareerPath, Roadmap
from app.models.content import (
    AptitudeAttempt, ChatMessage, CodingAttempt, InterviewSession,
)
from app.models.job import Application, Job
from app.models.resume import Resume, ResumeAnalysis
from app.models.user import User
from app.schemas.schemas import (
    AdminCareerCreate, AdminCareerUpdate, AdminJobCreate, AdminJobUpdate,
    AdminUserListOut, AdminUserOut, AdminUserUpdate, CareerOut, JobOut,
)

router = APIRouter(prefix="/admin", tags=["admin"])


def _naive_utc_now() -> datetime:
    """Naive UTC timestamp matching how DateTime columns store values."""
    return datetime.now(timezone.utc).replace(tzinfo=None)


# ---------------------------------------------------------------- stats
@router.get("/stats")
def admin_stats(admin: AdminUser, db: DbSession):
    week_ago = _naive_utc_now() - timedelta(days=7)

    def count(model, *criteria) -> int:
        q = db.query(func.count(model.id))
        for c in criteria:
            q = q.filter(c)
        return int(q.scalar() or 0)

    recent = db.query(User).order_by(User.created_at.desc()).limit(8).all()
    return {
        "users": {
            "total": count(User),
            "active": count(User, User.is_active.is_(True)),
            "admins": count(User, User.role == "admin"),
            "new_last_7_days": count(User, User.created_at >= week_ago),
        },
        "activity": {
            "career_assessments": count(InterviewSession),
            "resumes_analyzed": count(ResumeAnalysis),
            "resumes_uploaded": count(Resume),
            "roadmaps_created": count(Roadmap),
            "applications_tracked": count(Application),
            "aptitude_attempts": count(AptitudeAttempt),
            "coding_attempts": count(CodingAttempt),
            "chat_messages": count(ChatMessage),
        },
        "content": {
            "career_paths": count(CareerPath),
            "jobs_listed": count(Job),
            "jobs_active": count(Job, Job.is_active.is_(True)),
            "jobs_sample": count(Job, Job.is_sample.is_(True)),
        },
        "recent_users": [AdminUserOut.model_validate(u).model_dump(mode="json")
                         for u in recent],
        "generated_at": datetime.now(timezone.utc).isoformat(),
    }


# ---------------------------------------------------------------- users
@router.get("/users", response_model=AdminUserListOut)
def list_users(
    admin: AdminUser,
    db: DbSession,
    q: str = "",
    role: str = "",
    status: str = "",
    page: int = Query(1, ge=1),
    page_size: int = Query(10, ge=1, le=100),
):
    query = db.query(User)
    if q.strip():
        like = f"%{q.strip()}%"
        query = query.filter(or_(User.full_name.ilike(like),
                                 User.email.ilike(like)))
    if role in ("student", "admin"):
        query = query.filter(User.role == role)
    if status == "active":
        query = query.filter(User.is_active.is_(True))
    elif status == "disabled":
        query = query.filter(User.is_active.is_(False))
    total = int(query.count())
    users = (query.order_by(User.created_at.desc())
             .offset((page - 1) * page_size).limit(page_size).all())
    return AdminUserListOut(
        items=[AdminUserOut.model_validate(u) for u in users],
        total=total, page=page, page_size=page_size,
    )


@router.patch("/users/{user_id}", response_model=AdminUserOut)
def update_user(user_id: int, payload: AdminUserUpdate,
                admin: AdminUser, db: DbSession):
    target = db.get(User, user_id)
    if target is None:
        raise HTTPException(status_code=404, detail="User not found")

    changing_role = payload.role is not None and payload.role != target.role
    disabling = payload.is_active is False and target.is_active

    # Never let the current admin lock or demote themselves.
    if target.id == admin.id and (changing_role or disabling):
        raise HTTPException(
            status_code=400,
            detail="You cannot change your own role or disable your own account",
        )
    if changing_role:
        if target.role == "admin" and payload.role == "student":
            admins = db.query(func.count(User.id)).filter(
                User.role == "admin").scalar() or 0
            if admins <= 1:
                raise HTTPException(
                    status_code=400,
                    detail="Cannot demote the last administrator",
                )
        target.role = payload.role
    if payload.is_active is not None:
        target.is_active = payload.is_active
    db.commit()
    db.refresh(target)
    return AdminUserOut.model_validate(target)


# ---------------------------------------------------------------- careers
@router.get("/careers", response_model=list[CareerOut])
def admin_list_careers(admin: AdminUser, db: DbSession):
    rows = db.query(CareerPath).order_by(CareerPath.name).all()
    return [CareerOut.model_validate(r) for r in rows]


def _skills_to_json(skills) -> str:
    if isinstance(skills, list):
        return json.dumps({name: 80 for name in skills})
    return json.dumps(skills)


@router.post("/careers", status_code=201)
def create_career(payload: AdminCareerCreate, admin: AdminUser, db: DbSession):
    exists = db.query(CareerPath).filter(
        func.lower(CareerPath.name) == payload.name.lower()).first()
    if exists:
        raise HTTPException(status_code=400,
                            detail="A career path with this name already exists")
    row = CareerPath(
        name=payload.name.strip(), category=payload.category,
        description=payload.description,
        required_skills=_skills_to_json(payload.required_skills),
        responsibilities=json.dumps(payload.responsibilities),
        roadmap=json.dumps(payload.roadmap),
        projects=json.dumps(payload.projects),
        interview_topics=json.dumps(payload.interview_topics),
        certifications=json.dumps(payload.certifications),
        salary_range=payload.salary_range, demand_level=payload.demand_level,
        growth_potential=payload.growth_potential,
    )
    db.add(row)
    db.commit()
    db.refresh(row)
    return CareerOut.model_validate(row)


@router.patch("/careers/{career_id}", response_model=CareerOut)
def update_career(career_id: int, payload: AdminCareerUpdate,
                  admin: AdminUser, db: DbSession):
    row = db.get(CareerPath, career_id)
    if row is None:
        raise HTTPException(status_code=404, detail="Career path not found")
    data = payload.model_dump(exclude_unset=True)
    if "required_skills" in data and data["required_skills"] is not None:
        data["required_skills"] = _skills_to_json(data.pop("required_skills"))
    for key in ("responsibilities", "roadmap", "projects",
                "interview_topics", "certifications"):
        if key in data and data[key] is not None:
            data[key] = json.dumps(data.pop(key))
    if data.get("name"):
        dup = db.query(CareerPath).filter(
            CareerPath.id != career_id,
            func.lower(CareerPath.name) == data["name"].lower()).first()
        if dup:
            raise HTTPException(
                status_code=400,
                detail="A career path with this name already exists")
        data["name"] = data["name"].strip()
    for k, v in data.items():
        if v is not None:
            setattr(row, k, v)
    db.commit()
    db.refresh(row)
    return CareerOut.model_validate(row)


@router.delete("/careers/{career_id}")
def delete_career(career_id: int, admin: AdminUser, db: DbSession):
    row = db.get(CareerPath, career_id)
    if row is None:
        raise HTTPException(status_code=404, detail="Career path not found")
    db.delete(row)
    db.commit()
    return {"deleted": career_id}


# ---------------------------------------------------------------- jobs
@router.get("/jobs", response_model=list[JobOut])
def admin_list_jobs(admin: AdminUser, db: DbSession):
    rows = db.query(Job).order_by(Job.posted_on.desc()).all()
    out = []
    for r in rows:
        item = JobOut.model_validate(r)
        item.match_score = 0.0
        item.saved = False
        out.append(item)
    return out


@router.post("/jobs", status_code=201)
def create_job(payload: AdminJobCreate, admin: AdminUser, db: DbSession):
    row = Job(
        title=payload.title.strip(), company=payload.company.strip(),
        location=payload.location, work_mode=payload.work_mode,
        salary=payload.salary, job_type=payload.job_type,
        skills=json.dumps(payload.skills),
        experience_label=payload.experience_label,
        description=payload.description, industry=payload.industry,
        is_active=payload.is_active, is_sample=False,
    )
    db.add(row)
    db.commit()
    db.refresh(row)
    return JobOut.model_validate(row)


@router.patch("/jobs/{job_id}", response_model=JobOut)
def update_job(job_id: int, payload: AdminJobUpdate,
               admin: AdminUser, db: DbSession):
    row = db.get(Job, job_id)
    if row is None:
        raise HTTPException(status_code=404, detail="Listing not found")
    data = payload.model_dump(exclude_unset=True)
    if data.get("skills") is not None:
        data["skills"] = json.dumps(data.pop("skills"))
    if data.get("title"):
        data["title"] = data["title"].strip()
    if data.get("company"):
        data["company"] = data["company"].strip()
    for k, v in data.items():
        if v is not None:
            setattr(row, k, v)
    db.commit()
    db.refresh(row)
    return JobOut.model_validate(row)


@router.delete("/jobs/{job_id}")
def delete_job(job_id: int, admin: AdminUser, db: DbSession):
    row = db.get(Job, job_id)
    if row is None:
        raise HTTPException(status_code=404, detail="Listing not found")
    db.delete(row)
    db.commit()
    return {"deleted": job_id}


# ---------------------------------------------------------------- settings
@router.get("/settings")
def admin_settings(admin: AdminUser, db: DbSession):
    """Non-secret platform configuration + operational status.
    Secrets (API keys, secret key, DB credentials) are never returned."""
    has_openai = bool(settings.OPENAI_API_KEY.strip())
    has_gemini = bool(settings.GEMINI_API_KEY.strip())
    mock = settings.MOCK_AI_MODE or settings.AI_PROVIDER == "mock"
    return {
        "app_name": settings.APP_NAME,
        "debug": settings.DEBUG,
        "seed_demo_data": settings.SEED_DEMO_DATA,
        "database_backend": ("postgresql"
                             if settings.DATABASE_URL.startswith("postgres")
                             else "sqlite"),
        "cors_origins": settings.cors_origin_list,
        "uploads": {
            "max_size_mb": settings.MAX_UPLOAD_SIZE_MB,
            "allowed_extensions": sorted(settings.allowed_extensions),
        },
        "ai": {
            "provider": settings.AI_PROVIDER,
            "mode": "mock (deterministic fallback)" if mock else "live",
            "live_configured": (not mock) and (has_openai or has_gemini),
            "openai_key_present": has_openai,
            "gemini_key_present": has_gemini,
            "note": ("Only key presence is reported — keys themselves are "
                     "never exposed by the API."),
        },
        "health": {"status": "healthy", "api": settings.APP_NAME},
        "checked_at": datetime.now(timezone.utc).isoformat(),
    }


